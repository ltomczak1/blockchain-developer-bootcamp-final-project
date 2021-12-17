// SPDX-License-Identifier: MIT
pragma solidity ^0.5.0;

//import our token
import "./Token.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

//Deposit and Withdraw Funds
//Manage Orders (make or cancel)
//Perfrom Trades/Charge fees.

//To do:
// [x] set fee account
//[x] deposit ether
//[x] withdraw ether
//[x]deposit tokens
//[x]withdraw tokens
// [x] check balances
// [x] make order
// [x] cancel order
// [x] fill order
// [x]charge fees

contract Exchange {
    using SafeMath for uint;

    // Variables
    address public feeAccount; // account that receives exchange fees
    address constant ETHER = address(0); //store ether in tokens mapping with blank address
    uint256 public feePercent; // fee percentage
    uint256 public orderCount; //counter cache for ids
    mapping(address => mapping(address => uint256)) public tokens; //track deposited tokens. key 1 token address, key 2 user address, uint number of tokens
    mapping(uint256 => _Order) public orders; //store orders. key order id, value _Order struct. 
    mapping(uint256 => bool) public orderCancelled; //mapping to store cancelled orders
    mapping(uint256 => bool) public orderFilled; // mapping to store filled orders

    // Events
    event Deposit(address token, address user, uint256 amount, uint256 balance);
    event Withdraw(address token, address user, uint256 amount, uint256 balance);
    event Order(
        uint256 id,
        address user,
        address tokenGet,
        uint256 amountGet,
        address tokenGive,
        uint256 amountGive,
        uint256 timestamp
    );

    event Cancel(
        uint256 id,
        address user,
        address tokenGet,
        uint256 amountGet,
        address tokenGive,
        uint256 amountGive,
        uint256 timestamp
    );

    event Trade(
        uint256 id,
        address user,
        address tokenGet,
        uint256 amountGet,
        address tokenGive,
        uint256 amountGive,
        address userFill,
        uint256 timestamp
    );

    //Structs
    // Model Orders
    struct _Order {
        uint256 id; //order id
        address user; // person who created order
        address tokenGet; // address of token want to purchase
        uint256 amountGet; // amount of tokens wanted for purchase
        address tokenGive; // type of token using for trade 
        uint256 amountGive; // amount of token using for trade
        uint256 timestamp; // time order created
    }

    constructor (address _feeAccount, uint256 _feePercent) public {
        //set fee account at contract creation.
        feeAccount = _feeAccount;
        //set fee percent at contract creation
        feePercent = _feePercent;
    }

    //Fallback - revert if ether is sent to this smart contract by mistake
    function() external {
        revert();
    }

    function depositEther() payable public {
        //manage and track ether deposits (increment)
        tokens[ETHER][msg.sender] = tokens[ETHER][msg.sender].add(msg.value);
        emit Deposit(ETHER, msg.sender, msg.value, tokens[ETHER][msg.sender]);

    }

    function withdrawEther(uint _amount) public {
        //require sufficient balance to withdraw
        require(tokens[ETHER][msg.sender] >= _amount);
        //decrement amount
        tokens[ETHER][msg.sender] = tokens[ETHER][msg.sender].sub(_amount);
        msg.sender.transfer(_amount);
        // emit withdrawl event
        emit Withdraw(ETHER, msg.sender, _amount, tokens[ETHER][msg.sender]);
    }

    //Deposit our token (also works for other ERC 20 tokens)
    //which token and address where it is, how much
    function depositToken(address _token, uint _amount) public {
        // Don't allow ether deposits by excluding ether address
        require(_token != ETHER);
        // send tokens to this contract
        require(Token(_token).transferFrom(msg.sender, address(this), _amount));
        // manage deposits - track current balance
        tokens[_token][msg.sender] = tokens[_token][msg.sender].add(_amount);
        // emit associated event (token address, user address, amount, current balance.)
        emit Deposit(_token, msg.sender, _amount, tokens[_token][msg.sender]);
    }

    function withdrawToken(address _token, uint256 _amount) public {
        // make sure not ether address
        require(_token != ETHER);
        // make sure they have enough tokens to withdraw
        require(tokens[_token][msg.sender] >= _amount);
        //decrement amount
        tokens[_token][msg.sender] = tokens[_token][msg.sender].sub(_amount);
        // transfer tokens from smart contract
        require(Token(_token).transfer(msg.sender, _amount));
        // emit token withdrawl event
        emit Withdraw(_token, msg.sender, _amount, tokens[_token][msg.sender]);
    }

    //check balances
    function balanceOf(address _token, address _user) public view returns (uint256) {
        return tokens[_token][_user];
    }

    //add orders to storage/mapping
    function makeOrder(address _tokenGet, uint256 _amountGet, address _tokenGive, uint256 _amountGive) public {
        //track order ids
        orderCount = orderCount.add(1);
        // add new order to orders mapping
        orders[orderCount] = _Order(orderCount, msg.sender, _tokenGet, _amountGet, _tokenGive, _amountGive, now); //check order count id?
        // emit Order event when order is made
        emit Order(orderCount, msg.sender, _tokenGet, _amountGet, _tokenGive, _amountGive, now);
    }

    //cancel orders
    function cancelOrder(uint256 _id) public {
        //fetch order from mapping
        _Order storage _order = orders[_id];
        //ensure maker of order is only address that can call this function
        require(address(_order.user) == msg.sender);
        //the order must exist to cancel
        require(_order.id == _id);
        //update orderCancelled mapping to be cancelled
        orderCancelled[_id] = true;
        // emit Cancel event when cancellation is made
        emit Cancel(_order.id, msg.sender, _order.tokenGet, _order.amountGet, _order.tokenGive, _order.amountGive, now);
    }

    //filling orders
    function fillOrder(uint256 _id) public {
        //require we're filling a valid order
        require(_id > 0 && _id <= orderCount);
        //require order has not been cancelled or filled already
        require(!orderFilled[_id]);
        require(!orderCancelled[_id]);
        //fetch the order from storage
        _Order storage _order = orders[_id];
        _trade(_order.id, _order.user, _order.tokenGet, _order.amountGet, _order.tokenGive, _order.amountGive);
        //mark order as filled
        orderFilled[_order.id] = true;
    }

    function _trade(uint256 _orderId, address _user, address _tokenGet, uint256 _amountGet, address _tokenGive, uint256 _amountGive) internal {
        // calculate fee
        uint256 _feeAmount = _amountGet.mul(feePercent).div(100);
        //execute trade and charge fees to account filling order (msg.sender)
        tokens[_tokenGet][msg.sender] = tokens[_tokenGet][msg.sender].sub(_amountGet.add(_feeAmount)); //subtract amount get + fee amount charged from senders balance (sender fills order)
        tokens[_tokenGet][_user] = tokens[_tokenGet][_user].add(_amountGet); //put senders subtracted amount and put in users balance (user created order)
        tokens[_tokenGet][feeAccount] = tokens[_tokenGet][feeAccount].add(_feeAmount); //update fee account balance with fee amount
        tokens[_tokenGive][_user] = tokens[_tokenGive][_user].sub(_amountGive); // subtract the amount give from balance of user who created order
        tokens[_tokenGive][msg.sender] = tokens[_tokenGive][msg.sender].add(_amountGive); //add that to person msg.senders balance who is filling the order
        //emit trade event
        emit Trade(_orderId, _user, _tokenGet, _amountGet, _tokenGive, _amountGive, msg.sender, now);
    }
}

