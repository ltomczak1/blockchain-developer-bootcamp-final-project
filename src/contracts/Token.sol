// SPDX-License-Identifier: MIT
pragma solidity ^0.5.0;
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract Token {
    using SafeMath for uint;

    //Variables
    string public name = "Consensys Blockchain Developer Bootcamp Token";
    string public symbol = "CBDB";
    uint256 public decimals = 18;
    uint256 public totalSupply;
    //Track Balances
    mapping(address => uint256) public balanceOf;
    //tracks tokens for exchange
    mapping(address => mapping(address => uint256)) public allowance;
    
    //Events
    //Required transfer event
    event Transfer(address indexed from, address to, uint256 value);
    //required approval event
    event Approval(address indexed owner, address indexed spender, uint256 value);
    
    //Set total supply. Allocate to deployer of this contract
    constructor() public {
        totalSupply = 1000000 * (10 ** decimals);
        balanceOf[msg.sender] = totalSupply;
    }

    //Transfer Tokens
    function transfer(address _to, uint256 _value) public returns (bool success) {
        // require sender has larger balance than value of tokens sending
        require(balanceOf[msg.sender] >= _value);
        _transfer(msg.sender, _to, _value);
        return true;
    }

    //delegated transfers
    function _transfer(address _from, address _to, uint256 _value) internal {
        // require we cannot send to invalid address
        require(_to != address(0));
        // debit from balance
        balanceOf[_from] = balanceOf[_from].sub(_value);
        //credit to balance
        balanceOf[_to] = balanceOf[_to].add(_value);
        emit Transfer(_from, _to, _value);
    }

    //Approve Tokens/Delegation (allow someone else to spend tokens)
    function approve(address _spender, uint256 _value) public returns (bool success) {
        require(_spender != address(0));
        allowance[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
        return true;
    }

    //Transfer From (allow exchange to move tokens)
    function transferFrom(address _from, address _to, uint256 _value) public returns (bool success) {
        //value less than balance of from account
        require(_value <= balanceOf[_from]);
        //value must be less than approved amount for the exchange
        require(_value <= allowance[_from][msg.sender]);
        //reset delegated token allowance to zero
        allowance[_from][msg.sender] = allowance[_from][msg.sender].sub(_value);
        _transfer(_from, _to, _value);
        return true;
    }
}