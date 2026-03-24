// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TestFaucetERC20 {
    error FaucetTooSoon(uint256 nextAvailableAt);
    error InsufficientAllowance();
    error InsufficientBalance();
    error InvalidAddress();
    error Unauthorized();

    string public name;
    string public symbol;
    uint8 public immutable decimals;
    uint256 public totalSupply;
    uint256 public faucetAmount;
    uint256 public faucetCooldown;
    address public owner;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => uint256) public nextFaucetAt;

    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Faucet(address indexed operator, address indexed recipient, uint256 amount);
    event FaucetAmountUpdated(uint256 faucetAmount);
    event FaucetCooldownUpdated(uint256 faucetCooldown);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Transfer(address indexed from, address indexed to, uint256 value);

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert Unauthorized();
        }
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 initialSupply_,
        uint256 faucetAmount_,
        uint256 faucetCooldown_
    ) {
        owner = msg.sender;
        name = name_;
        symbol = symbol_;
        decimals = decimals_;
        faucetAmount = faucetAmount_;
        faucetCooldown = faucetCooldown_;

        emit OwnershipTransferred(address(0), msg.sender);

        if (initialSupply_ > 0) {
            _mint(msg.sender, initialSupply_);
        }
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 currentAllowance = allowance[from][msg.sender];
        if (currentAllowance < amount) {
            revert InsufficientAllowance();
        }

        unchecked {
            allowance[from][msg.sender] = currentAllowance - amount;
        }

        emit Approval(from, msg.sender, allowance[from][msg.sender]);
        _transfer(from, to, amount);
        return true;
    }

    function faucet(address recipient) external returns (uint256) {
        if (recipient == address(0)) {
            revert InvalidAddress();
        }

        uint256 availableAt = nextFaucetAt[recipient];
        if (block.timestamp < availableAt) {
            revert FaucetTooSoon(availableAt);
        }

        if (faucetCooldown > 0) {
            nextFaucetAt[recipient] = block.timestamp + faucetCooldown;
        } else {
            nextFaucetAt[recipient] = block.timestamp;
        }

        _mint(recipient, faucetAmount);
        emit Faucet(msg.sender, recipient, faucetAmount);
        return faucetAmount;
    }

    function ownerMint(address recipient, uint256 amount) external onlyOwner returns (bool) {
        _mint(recipient, amount);
        return true;
    }

    function setFaucetAmount(uint256 amount) external onlyOwner {
        faucetAmount = amount;
        emit FaucetAmountUpdated(amount);
    }

    function setFaucetCooldown(uint256 cooldownSeconds) external onlyOwner {
        faucetCooldown = cooldownSeconds;
        emit FaucetCooldownUpdated(cooldownSeconds);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) {
            revert InvalidAddress();
        }

        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function _transfer(address from, address to, uint256 amount) internal {
        if (to == address(0)) {
            revert InvalidAddress();
        }

        uint256 fromBalance = balanceOf[from];
        if (fromBalance < amount) {
            revert InsufficientBalance();
        }

        unchecked {
            balanceOf[from] = fromBalance - amount;
        }
        balanceOf[to] += amount;

        emit Transfer(from, to, amount);
    }

    function _mint(address recipient, uint256 amount) internal {
        if (recipient == address(0)) {
            revert InvalidAddress();
        }

        totalSupply += amount;
        balanceOf[recipient] += amount;
        emit Transfer(address(0), recipient, amount);
    }
}
