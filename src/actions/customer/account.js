import { makeCustomerProfile, makeFavoritesLookup } from 'open-tender-js'
import { pending, fulfill, reject, MISSING_CUSTOMER } from '../../utils'
import {
  RESET_CUSTOMER,
  LOGIN_CUSTOMER,
  LOGOUT_CUSTOMER,
  FETCH_CUSTOMER,
  UPDATE_CUSTOMER,
} from '../../reducers/customer/account'
import { setSelectedAllergens } from '../allergens'
import { setCustomerAllergens } from './allergens'
import { resetOrder } from '../order'
import { resetCheckout } from '../checkout'
import { showNotification } from '../notifications'
import { selectToken } from '../../selectors/customer'
import { setCustomerGiftCards } from './giftCards'
import { setCustomerFavorites, setCustomerFavoritesLookup } from './favorites'

// action creators

export const resetCustomer = () => ({ type: RESET_CUSTOMER })

// async action creators

export const loginCustomer = (email, password) => async (
  dispatch,
  getState
) => {
  const { api } = getState().config
  if (!api) return
  dispatch(pending(LOGIN_CUSTOMER))
  try {
    const auth = await api.postLogin(email, password)
    dispatch(fulfill(LOGIN_CUSTOMER, auth))
    dispatch(fetchCustomer())
  } catch (err) {
    dispatch(reject(LOGIN_CUSTOMER, err.message))
  }
}

export const logoutCustomer = () => async (dispatch, getState) => {
  const { api } = getState().config
  if (!api) return
  const token = selectToken(getState())
  if (!token) return dispatch(reject(LOGOUT_CUSTOMER, null))
  dispatch(pending(LOGOUT_CUSTOMER))
  try {
    dispatch(resetOrder())
    dispatch(resetCheckout())
    dispatch(setSelectedAllergens(null))
    await api.postLogout(token)
    dispatch(fulfill(LOGOUT_CUSTOMER, null))
  } catch (err) {
    dispatch(reject(LOGOUT_CUSTOMER, null))
  }
}

export const fetchCustomer = () => async (dispatch, getState) => {
  const { api } = getState().config
  if (!api) return
  const token = selectToken(getState())
  if (!token) return dispatch(reject(FETCH_CUSTOMER, MISSING_CUSTOMER))
  dispatch(pending(FETCH_CUSTOMER))
  try {
    const customer = await api.getCustomer(token)
    const { allergens, gift_cards, favorites } = customer
    if (allergens.length) {
      dispatch(setCustomerAllergens(allergens))
      dispatch(setSelectedAllergens(allergens))
    }
    if (gift_cards.length) dispatch(setCustomerGiftCards(gift_cards))
    if (favorites.length) {
      dispatch(setCustomerFavorites(favorites))
      const lookup = makeFavoritesLookup(favorites)
      dispatch(setCustomerFavoritesLookup(lookup))
    }
    const profile = makeCustomerProfile(customer)
    dispatch(fulfill(FETCH_CUSTOMER, profile))
  } catch (err) {
    dispatch(reject(FETCH_CUSTOMER, err))
  }
}

export const updateCustomer = data => async (dispatch, getState) => {
  const { api } = getState().config
  if (!api) return
  const token = selectToken(getState())
  if (!token) return dispatch(reject(UPDATE_CUSTOMER, MISSING_CUSTOMER))
  dispatch(pending(UPDATE_CUSTOMER))
  try {
    const customer = await api.putCustomer(token, data)
    const profile = makeCustomerProfile(customer)
    dispatch(fulfill(UPDATE_CUSTOMER, profile))
    dispatch(showNotification('Account updated!'))
  } catch (err) {
    dispatch(reject(UPDATE_CUSTOMER, err))
  }
}
