//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "./Token.sol";

contract AMM {
	Token public token1;
	Token public token2;

	uint256 public token1Balance;
	uint256 public token2Balance;
	uint256 public K;

	uint256 public totalShares;
	mapping(address => uint256) public shares;
	uint256 constant PRECISION = 10**18;

	event Swap(
		address user,
		address tokenGive,
		uint256 tokenGiveAmount,
		address tokenGet,
		uint256 tokenGetAmount,
		uint256 token1Balance,
		uint256 token2Balance,
		uint256 timestamp
	);

	constructor(Token _token1, Token _token2) {
		token1 = _token1;
		token2 = _token2;
	}

	function addLiquidity(uint256 _token1Amount, uint256 _token2Amount) external {

		// Deposit tokens
		require(
			token1.transferFrom(msg.sender, address(this), _token1Amount),
			"failed to transfer token 1"
		);
		require(
			token2.transferFrom(msg.sender, address(this), _token2Amount),
			"failed to transfer token 2"
		);

		uint256 share;

		// Issue shares
		if(totalShares == 0) {
			share = 100 * PRECISION;
		} else {
			uint256 share1 = (totalShares * _token1Amount) / token1Balance;
			uint256 share2 = (totalShares * _token2Amount) / token2Balance;
			require(
				(share1 / 10**3 == share2 / 10**3),
				"must provide equal token amounts"
			);
			share = share1;
		}

		// Manage pool
		token1Balance += _token1Amount;
		token2Balance += _token2Amount;
		K = token1Balance * token2Balance;

		// update shares
		totalShares += share;
		shares[msg.sender] += share;
	}

	// Determine how many token2 must be deposited when depositing NNN token1
	function calculateToken2Deposit(uint256 _token1Amount)
		public view
		returns(uint256 token2Amount) 
	{
		token2Amount = (token2Balance * _token1Amount) / token1Balance;
	}

	// Determine how many token1 must be deposited when depositing NNN token2
	function calculateToken1Deposit(uint256 _token2Amount)
		public view
		returns(uint256 token1Amount) 
	{
		token1Amount = (token1Balance * _token2Amount) / token2Balance;
	}

	function calculateToken1Swap(uint256 _token1Amount)
		public view
		returns (uint256 token2Amount)
	{
		uint256 token1After = token1Balance + _token1Amount;
		uint256 token2After = K / token1After;
		token2Amount = token2Balance - token2After;

		// don't let pool go to 0
		if(token2Amount == token2Balance) {
			token2Amount--;
		}

		require(token2Amount < token2Balance, "swap cannot exceed pool balance");
	}

	function calculateToken2Swap(uint256 _token2Amount)
		public view
		returns (uint256 token1Amount)
	{
		uint256 token2After = token2Balance + _token2Amount;
		uint256 token1After = K / token2After;
		token1Amount = token1Balance - token1After;

		// don't let pool go to 0
		if(token1Amount == token1Balance) {
			token1Amount--;
		}

		require(token1Amount < token1Balance, "swap cannot exceed pool balance");
	}

	function swapToken1(uint256 _token1Amount)
		external
		returns(uint256 token2Amount)
	{
		// calculate token 2 amount
		token2Amount = calculateToken1Swap(_token1Amount);

		// do swap
		// transfer tokens from user wallet to contract
		token1.transferFrom(msg.sender, address(this), _token1Amount);
		// update token 1 balance in the contract
		token1Balance += _token1Amount;
		// update token 2 balance in the contract
		token2Balance -= token2Amount;
		// transfer token 2 tokens from contract to user wallet
		token2.transfer(msg.sender, token2Amount);

		// emit event
		emit Swap(
			msg.sender,
			address(token1),
			_token1Amount,
			address(token2),
			token2Amount,
			token1Balance,
			token2Balance,
			block.timestamp
		);
	}

	function swapToken2(uint256 _token2Amount)
		external
		returns(uint256 token1Amount)
	{
		// calculate token 1 amount
		token1Amount = calculateToken2Swap(_token2Amount);

		// do swap
		// transfer tokens from user wallet to contract
		token2.transferFrom(msg.sender, address(this), _token2Amount);
		// update token 1 balance in the contract
		token2Balance += _token2Amount;
		// update token 2 balance in the contract
		token1Balance -= token1Amount;
		// transfer token 2 tokens from contract to user wallet
		token1.transfer(msg.sender, token1Amount);

		// emit event
		emit Swap(
			msg.sender,
			address(token2),
			_token2Amount,
			address(token1),
			token1Amount,
			token1Balance,
			token2Balance,
			block.timestamp
		);
	}

	// Determine how many tokens will be withdrawn
	function calculateWithdrawAmount(uint256 _share)
		public view
		returns(uint256 token1Amount, uint256 token2Amount)
	{
		require(_share <= totalShares, "must be less than total shares");
		token1Amount = (_share * token1Balance) / totalShares;
		token2Amount = (_share * token2Balance) / totalShares;
	}

	// Removes liquidity from the pool
	function removeLiquidity(uint256 _share)
		external
		returns(uint256 token1Amount, uint256 token2Amount)
	{
		require(
			_share <= shares[msg.sender],
			"cannot withdraw more shares than you have"
		);

		(token1Amount, token2Amount) = calculateWithdrawAmount(_share);

		// update user shares
		shares[msg.sender] -= _share;
		totalShares -= _share;

		// update balances and K
		token1Balance -= token1Amount;
		token2Balance -= token2Amount;
		K = token1Balance * token2Balance;

		// transfer tokens back to user
		token1.transfer(msg.sender, token1Amount);
		token2.transfer(msg.sender, token2Amount);

		// emit Event as homework
	}

}
