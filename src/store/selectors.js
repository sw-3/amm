import { createSelector } from 'reselect'

const tokens = state => state.tokens.contracts
const swaps = state => state.amm.swaps

export const chartSelector = createSelector(swaps, tokens, (swaps, tokens) => {

  if (!tokens[0] || !tokens[1]) { return }

  // filter swaps by selected tokens
  swaps = swaps.filter((s) => s.args.tokenGet === tokens[0].address || s.args.tokenGet === tokens[1].address)
  swaps = swaps.filter((s) => s.args.tokenGive === tokens[0].address || s.args.tokenGive === tokens[1].address)

  // sort swaps by date to compare history
  swaps = swaps.sort((a, b) => a.args.timestamp - b.args.timestamp)

  // decorate swaps - add display attributes
  swaps = swaps.map((s) => decorateSwap(s))

  // fetch prices
  const prices = swaps.map(s => s.rate)

  swaps = swaps.sort((a, b) => b.args.timestamp - a.args.timestamp)

  return({
    swaps: swaps,
    series: [{
      name: 'Rate',
      data: prices
    }]
  })
})

const decorateSwap = (swap) => {

  const precision = 100000

  let rate = (swap.args.token2Balance / swap.args.token1Balance)
  rate = Math.round(rate * precision) / precision

  return({
    ...swap,
    rate
  })
}
