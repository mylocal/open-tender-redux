import {
  isEmpty,
  contains,
  isString,
  // getDefaultTip,
  prepareOrder,
  handleCheckoutErrors,
} from '@open-tender/js'
import { pending, fulfill, reject } from '../utils'
import {
  RESET_CHECKOUT,
  RESET_ERRORS,
  RESET_CHECK,
  RESET_TIP,
  RESET_COMPLETED_ORDER,
  SET_COMPLETED_ORDER,
  SET_SUBMITTING,
  SET_GUEST,
  UPDATE_FORM,
  UPDATE_CUSTOMER,
  VALIDATE_ORDER,
  SUBMIT_ORDER,
} from '../reducers/checkout'
import { refreshRevenueCenter, setAlert } from './order'
import { fetchMenu } from './menu'
import { loginCustomer } from './customer/account'
import { selectToken } from '../selectors/customer'

// action creators

export const resetCheckout = () => ({ type: RESET_CHECKOUT })
export const resetCheck = () => ({ type: RESET_CHECK })
export const resetTip = () => ({ type: RESET_TIP })
export const resetErrors = () => ({ type: RESET_ERRORS })
export const resetCompletedOrder = () => ({ type: RESET_COMPLETED_ORDER })
export const setCompletedOrder = order => ({
  type: SET_COMPLETED_ORDER,
  payload: order,
})
export const setSubmitting = bool => ({ type: SET_SUBMITTING, payload: bool })
export const setGuest = bool => ({ type: SET_GUEST, payload: bool })
export const updateForm = form => ({ type: UPDATE_FORM, payload: form })
export const updateCheckoutCustomer = account => ({
  type: UPDATE_CUSTOMER,
  payload: account,
})

// async action creators

const refreshKeys = ['revenue_center_id', 'service_type', 'requested_at']

const makeRefreshArgs = order => ({
  revenueCenterId: order.revenue_center_id,
  serviceType: order.service_type,
  requestedAt: order.requested_at,
})

export const validateOrder = order => async (dispatch, getState) => {
  const { api } = getState().config
  if (!api) return
  const token = selectToken(getState())
  dispatch(pending(VALIDATE_ORDER))
  try {
    if (!order) order = assembleOrder(getState().data)
    const check = await api.postOrderValidate(order, token)
    const errMessages = handleCheckoutErrors({ params: check.errors })
    let errors = {}
    const keys = Object.keys(errMessages)
    const args = makeRefreshArgs(order)
    if (contains(keys, refreshKeys)) {
      dispatch(refreshRevenueCenter(args))
    } else if (contains(keys, ['cart'])) {
      const cartError = errMessages.cart
      if (isString(cartError)) {
        dispatch(fetchMenu(args))
      } else {
        const alert = { type: 'cartCounts', args: { errors: cartError } }
        dispatch(setAlert(alert))
      }
    } else if (contains(keys, ['promo_codes'])) {
      errors['promo_codes'] = errMessages.promo_codes
    }
    dispatch(fulfill(VALIDATE_ORDER, { check, errors }))
  } catch (err) {
    dispatch(reject(VALIDATE_ORDER, err))
  }
}

const assembleOrder = orderData => {
  const { order, checkout, groupOrder } = orderData
  const {
    orderId,
    revenueCenter,
    serviceType,
    requestedAt,
    cart,
    deviceType,
    prepType,
    table,
  } = order
  const { revenue_center_id: revenueCenterId } = revenueCenter || {}
  const { form } = checkout
  const {
    customer,
    address,
    details,
    surcharges,
    discounts,
    promoCodes,
    qrCodes,
    points,
    tenders,
    tip,
  } = form
  // const defaultTip = check ? getDefaultTip(check.config) : null
  const fullAddress = { ...order.address, ...address }
  const orderAddress =
    serviceType !== 'DELIVERY'
      ? null
      : isEmpty(fullAddress)
      ? null
      : fullAddress
  const data = {
    orderId,
    revenueCenterId,
    serviceType,
    requestedAt,
    cart,
    customer,
    address: orderAddress,
    details,
    surcharges,
    discounts,
    promoCodes,
    qrCodes,
    points,
    tip,
    // tip: tip === null ? defaultTip : tip,
    tenders,
    cartId: groupOrder.cartId || null,
    deviceType,
    prepType,
    table,
  }
  const preparedOrder = prepareOrder(data)
  return preparedOrder
}

const handleOrderErrors = (err, preparedOrder, dispatch) => {
  const errors = handleCheckoutErrors(err)
  const keys = Object.keys(errors)
  const args = makeRefreshArgs(preparedOrder)
  if (contains(keys, refreshKeys)) {
    dispatch(refreshRevenueCenter(args))
    dispatch(reject(SUBMIT_ORDER, {}))
  } else if (contains(keys, ['cart'])) {
    const cartError = errors.cart
    if (contains(cartError, ['delivery minimum', 'maximum'])) {
      return dispatch(reject(SUBMIT_ORDER, { form: cartError }))
    }
    if (isString(cartError)) {
      dispatch(fetchMenu(args))
    } else {
      const alert = { type: 'cartCounts', args: { errors: cartError } }
      setTimeout(() => {
        dispatch(setAlert(alert))
      }, 500)
    }
    dispatch(reject(SUBMIT_ORDER, {}))
  } else {
    dispatch(reject(SUBMIT_ORDER, errors))
  }
}

export const submitOrder = () => async (dispatch, getState) => {
  const { api } = getState().config
  if (!api) return
  const token = selectToken(getState())
  dispatch(pending(SUBMIT_ORDER))
  const alert = { type: 'working', args: { text: 'Submitting your order...' } }
  dispatch(setAlert(alert))
  const preparedOrder = assembleOrder(getState().data)
  try {
    const completedOrder = await api.postOrder(preparedOrder, token)
    const auth = getState().data.customer.account.auth
    const { email, password } = preparedOrder.customer
    if (password && !auth) await dispatch(loginCustomer(email, password))
    dispatch(setAlert({ type: 'close' }))
    dispatch(fulfill(SUBMIT_ORDER, completedOrder))
  } catch (err) {
    dispatch(setAlert({ type: 'close' }))
    handleOrderErrors(err, preparedOrder, dispatch)
  }
}

export const submitOrderPay =
  (showAlert = false) =>
  async (dispatch, getState) => {
    const { api } = getState().config
    if (!api) return
    const token = selectToken(getState())
    dispatch(setSubmitting(true))
    dispatch(pending(SUBMIT_ORDER))
    if (showAlert) {
      const alert = {
        type: 'working',
        args: { text: 'Submitting your order...' },
      }
      dispatch(setAlert(alert))
    }
    const preparedOrder = assembleOrder(getState().data)
    try {
      const completedOrder = await api.postOrder(preparedOrder, token)
      const auth = getState().data.customer.account.auth
      const { email, password } = preparedOrder.customer
      if (password && !auth) await dispatch(loginCustomer(email, password))
      dispatch(setAlert({ type: 'close' }))
      return completedOrder
    } catch (err) {
      dispatch(setAlert({ type: 'close' }))
      handleOrderErrors(err, preparedOrder, dispatch)
    }
  }
