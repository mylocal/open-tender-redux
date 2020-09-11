import { makeRandomNumberString } from '@open-tender/js'

const initState = []

const NAME = 'alerts'

export const ADD_ALERT = `${NAME}/addAlert`
export const DISMISS_ALERT = `${NAME}/dismissAlert`

export default (state = initState, action) => {
  switch (action.type) {
    case ADD_ALERT:
      return [
        ...state,
        { message: action.payload, id: makeRandomNumberString() },
      ]
    case DISMISS_ALERT:
      return state.filter(i => i.id !== action.payload)
    default:
      return state
  }
}