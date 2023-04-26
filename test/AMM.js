const { expect } = require('chai');
const { ethers } = require('hardhat');

const tokens = (n) => {
  return ethers.utils.parseUnits(n.toString(), 'ether')
}

const ether = tokens

describe('AMM', () => {
  let accounts, 
      deployer, 
      liquidityProvider,
      investor1,
      investor2

  let token1, token2, amm

  beforeEach(async () => {
    // setup accounts
    accounts = await ethers.getSigners()
    deployer = accounts[0]
    liquidityProvider = accounts[1]
    investor1 = accounts[2]
    investor2 = accounts[3]

    // deploy tokens
    const Token = await ethers.getContractFactory('Token')
    token1 = await Token.deploy('Dapp University', 'DAPP', '1000000')
    token2 = await Token.deploy('USD Token', 'USD', '1000000')

    // send tokens to liquidity provider
    let transaction = await token1.connect(deployer).transfer(liquidityProvider.address, tokens(100000))
    await transaction.wait()

    transaction = await token2.connect(deployer).transfer(liquidityProvider.address, tokens(100000))
    await transaction.wait()

    // send token1 to investor1
    transaction = await token1.connect(deployer).transfer(investor1.address, tokens(100000))
    await transaction.wait()

    // send token2 to investor2
    transaction = await token2.connect(deployer).transfer(investor2.address, tokens(100000))
    await transaction.wait()

    // deploy AMM
    const AMM = await ethers.getContractFactory('AMM')
    amm = await AMM.deploy(token1.address, token2.address)
  })

  describe('Deployment', () => {

    it('has an address', async () => {
      expect(amm.address).to.not.equal(0x0)
    })

    it('tracks token1 address', async () => {
      expect(await amm.token1()).to.equal(token1.address)
    })

    it('tracks token2 address', async () => {
      expect(await amm.token2()).to.equal(token2.address)
    })

  })


  describe('Swapping Tokens', () => {
    let amount, transaction, result, estimate, balance

    it('facilitates swaps', async () => {
      // deployer approves 100k tokens
      let amount = tokens(100000)
      transaction = await token1.connect(deployer).approve(amm.address, amount)
      await transaction.wait()

      transaction = await token2.connect(deployer).approve(amm.address, amount)
      await transaction.wait()

      // deployer adds liquidity
      transaction = await amm.connect(deployer).addLiquidity(amount, amount)
      await transaction.wait()

      // check AMM receives tokens
      expect(await token1.balanceOf(amm.address)).to.equal(amount)
      expect(await token2.balanceOf(amm.address)).to.equal(amount)

      expect(await amm.token1Balance()).to.equal(amount)
      expect(await amm.token2Balance()).to.equal(amount)

      // check deployer has 100 shares
      expect(await amm.shares(deployer.address)).to.equal(tokens(100))

      // check pool has 100 total shares
      expect(await amm.totalShares()).to.equal(tokens(100))


      //////////////////////////////////////////
      // LP adds more liquidity
      //

      // LP approves 50k tokens
      amount = tokens(50000)
      transaction = await token1.connect(liquidityProvider).approve(amm.address, amount)
      await transaction.wait()

      transaction = await token2.connect(liquidityProvider).approve(amm.address, amount)
      await transaction.wait()

      // calculate token2 deposit amount
      let token2Deposit = await amm.calculateToken2Deposit(amount)

      // LP adds liquidity
      transaction = await amm.connect(liquidityProvider).addLiquidity(amount, token2Deposit)
      await transaction.wait()

      // LP should have 50 shares
      expect(await amm.shares(liquidityProvider.address)).to.equal(tokens(50))

      // deployer still has 100 shares
      expect(await amm.shares(deployer.address)).to.equal(tokens(100))

      // pool should have 150 shares
      expect(await amm.totalShares()).to.equal(tokens(150))


      ///////////////////////////////////////////////
      // Investor 1 swaps
      //
      // investor 1 approves all tokens
      transaction = await token1.connect(investor1).approve(amm.address, tokens(100000))
      await transaction.wait()

      // check investor1 balance before swap
      balance = await token2.balanceOf(investor1.address)
      expect(balance).to.equal(0)

      // estimate # of tokens investor1 will receive
      estimate = await amm.calculateToken1Swap(tokens(1))

      // investor1 swaps token1
      transaction = await amm.connect(investor1).swapToken1(tokens(1))
      result = await transaction.wait()

      // check swap event
      await expect(transaction).to.emit(amm, 'Swap')
        .withArgs(
          investor1.address,
          token1.address,
          tokens(1),
          token2.address,
          estimate,
          await amm.token1Balance(),
          await amm.token2Balance(),
          (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp
      )

      // check investor1 balance after swap
      balance =  await token2.balanceOf(investor1.address)

      expect(balance).to.not.equal(0)
      expect(estimate).to.equal(balance)

      // check amm token balances are in sync
      expect(await token1.balanceOf(amm.address)).to.equal(await amm.token1Balance())
      expect(await token2.balanceOf(amm.address)).to.equal(await amm.token2Balance())

    })


  })

})
