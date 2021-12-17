const { default: Web3 } = require('web3')

//Importing from helpers.js
import { ether, tokens, EVM_REVERT, ETHER_ADDRESS } from './helpers'

const Token = artifacts.require('./Token')
const Exchange = artifacts.require('./Exchange')

require('chai')
    .use(require('chai-as-promised'))
    .should()


contract('Exchange', ([deployer, feeAccount, user1, user2]) => {
    let token
    let exchange
    const feePercent = 10

    beforeEach(async () => {
        // deploy token before each example
        token = await Token.new()
        //Transfer some tokens to user1 from deployer for test(who holds all of them)
        token.transfer(user1, tokens(100), { from: deployer })
        //deploy exchange, passing in fee account/ fee percent arguments to contracts constructor
        exchange = await Exchange.new(feeAccount, feePercent)
    })

    describe('Deployment', () => {
        it('tracks the fee account', async () => {
            // Read fee account here
            const result = await exchange.feeAccount()
            // result should equal fee account
            result.should.equal(feeAccount)
        })

        it('tracks the fee percent', async () => {
            // Read fee percent here
            const result = await exchange.feePercent()
            // result should equal fee percent
            result.toString().should.equal(feePercent.toString())
        })
    })

    describe('Fallback', () => {
        it('reverts when Ether is sent', async () => {
            await exchange.sendTransaction({ value: 1, from: user1 }).should.be.rejectedWith(EVM_REVERT)
        })
    })

    describe('Ether Deposits', async () => {
        let result
        let amount

        beforeEach(async () => {
            amount = ether(1)
            result = await exchange.depositEther({ from: user1, value: amount })
        })

        it('tracks the Ether deposit', async () => {
            const balance = await exchange.tokens(ETHER_ADDRESS, user1)
            balance.toString().should.equal(amount.toString())
        })

        it('emits a Deposit event', async () => {
            const log = result.logs[0]
            log.event.should.equal('Deposit')
            const event = log.args 
            event.token.should.equal(ETHER_ADDRESS, 'Ether address is correct')
            event.user.should.equal(user1, 'user address is correct')
            event.amount.toString().should.equal(amount.toString(), 'amount is correct')
            event.balance.toString().should.equal(amount.toString(), 'balance is correct')
        })

    })

    describe('Ether Withdrawls', async () => {
        let result
        let amount

        beforeEach(async () => {
            //Deposit ether from user 1 first to test withdrawls
            amount = ether(1)
            await exchange.depositEther({ from: user1, value: amount })
        })

        describe('success', async () => {
            beforeEach(async () => {
                //Withdraw Ether We deposited
                result = await exchange.withdrawEther(amount, { from: user1 })
            })

            it('withdraws Ether', async () => {
                //check ether has been withdrawn from tokens mapping
                const balance = await exchange.tokens(ETHER_ADDRESS, user1)
                balance.toString().should.equal('0')
            })

            it('emits Withdraw event', async () => {
                const log = result.logs[0]
                log.event.should.eq('Withdraw')
                const event = log.args
                event.token.should.equal(ETHER_ADDRESS)
                event.user.should.equal(user1)
                event.amount.toString().should.equal(amount.toString())
                event.balance.toString().should.equal('0')
            })
        })

        describe('failure', async () => {
            it('rejects withdawls for insufficient balances', async() => {
                await exchange.withdrawEther(ether(100), {from: user1 }).should.be.rejectedWith(EVM_REVERT)
            })
        })
    })

    describe('Token Deposits', () => {
        let result
        let amount = tokens(10)


        describe('success', () => {
            beforeEach(async () => {
                //approve exchange to transfer tokens before depositing only for succerssful cases
                await token.approve(exchange.address, amount, { from: user1 })
                //deposit tokens
                result = await exchange.depositToken(token.address, amount, { from: user1 })
            })

            it('tracks the token deposit', async () => {
                // check exchange token balance
                let balance
                balance = await token.balanceOf(exchange.address)
                balance.toString().should.equal(amount.toString())
                // check tokens on exchange
                balance = await exchange.tokens(token.address, user1)
                balance.toString().should.equal(amount.toString())
            })

            it('emits a Deposit event', async () => {
                const log = result.logs[0]
                log.event.should.equal('Deposit')
                const event = log.args 
                event.token.should.equal(token.address, 'token address is correct')
                event.user.should.equal(user1, 'user address is correct')
                event.amount.toString().should.equal(amount.toString(), 'amount is correct')
                event.balance.toString().should.equal(amount.toString(), 'balance is correct')
            })
        })

        describe('failure', () => {
            it('rejects Ether deposits', async() => {
                await exchange.depositToken(ETHER_ADDRESS, amount, { from: user1 }).should.be.rejectedWith(EVM_REVERT)
            })

            it('fails when no tokens are approved', async () => {
                //Don't approve any tokens before depositing
                await exchange.depositToken(token.address, amount, { from: user1 }).should.be.rejectedWith(EVM_REVERT)
            })
        })
    })

    describe('Token Withdrawls', () => {
        let result
        let amount

        describe('success', async() => {
            beforeEach(async () => {
                //Approve, then deposit tokens before attempting withdrawls.
                amount = tokens(10)
                await token.approve(exchange.address, amount, { from: user1 })
                await exchange.depositToken(token.address, amount, { from: user1 })

                //Withdraw tokens
                result = await exchange.withdrawToken(token.address, amount, { from: user1 })
            })    

            it('withdrew token funds', async () => {
                //Fetch balance, check funds were withdrawn
                const balance = await exchange.tokens(token.address, user1)
                balance.toString().should.equal('0')
            })

            it('emits a Withdrawl event', async () => {
                const log = result.logs[0]
                log.event.should.equal('Withdraw')
                const event = log.args
                event.token.should.equal(token.address)
                event.user.should.equal(user1)
                event.amount.toString().should.equal(amount.toString())
                event.balance.toString().should.equal('0')
            })
        })

        describe('failure', async () => {
            it('rejects Ether withdrawls', async () => {
                await exchange.withdrawToken(ETHER_ADDRESS, amount, { from: user1 }).should.be.rejectedWith(EVM_REVERT)
            })

            it('fails if user has insufficient balance', async () => {
                // attempt withdrawl with 0 balance
                await exchange.withdrawToken(token.address, amount, { from: user1 }).should.be.rejectedWith(EVM_REVERT)
            })
        })
    })

    describe('checking balances', () => {
        let amount
        //deposit something to check
        beforeEach(async () => {
            amount = ether(1)
            await exchange.depositEther({ from: user1, value: amount })
        })

        it('returns user balance', async () => {
            const result = await exchange.balanceOf(ETHER_ADDRESS, user1)
            result.toString().should.equal(amount.toString())
        })
    })

    describe('making orders', async () => {
        let result

        //make an order before each test
        beforeEach(async () => {
            result = await exchange.makeOrder(token.address, tokens(1), ETHER_ADDRESS, ether(1), { from: user1 })
        })

        it('tracks the newly created order', async () => {
            //check orderCount is set to 1.
            const orderCount = await exchange.orderCount()
            orderCount.toString().should.equal('1')
            //fetch order form mapping by its count
            const order = await exchange.orders('1')
            //check order attributes are correct
            order.id.toString().should.equal('1', 'id is correct')
            order.user.should.equal(user1, 'user is correct')
            order.tokenGet.should.equal(token.address, 'tokenGet is correct')
            order.amountGet.toString().should.equal(tokens(1).toString(), 'amountGet is correct')
            order.tokenGive.should.equal(ETHER_ADDRESS, 'tokenGive is correct')
            order.amountGive.toString().should.equal(ether(1).toString(), 'amountGive is correct')
            order.timestamp.toString().length.should.be.at.least(1, 'timestamp is present')
        })

        it('emits an Order event', async () => {
            const log = result.logs[0]
            log.event.should.equal('Order')
            const event = log.args
            event.id.toString().should.equal('1', 'id is correct')
            event.user.should.equal(user1, 'user is correct')
            event.tokenGet.should.equal(token.address, 'tokenGet is correct')
            event.amountGet.toString().should.equal(tokens(1).toString(), 'amountGet is correct')
            event.tokenGive.should.equal(ETHER_ADDRESS, 'tokenGive is correct')
            event.amountGive.toString().should.equal(ether(1).toString(), 'amountGive is correct')
            event.timestamp.toString().length.should.be.at.least(1, 'timestamp is present') 
        })
    })

    describe('order actions', async () => {
        
        beforeEach(async () => {
            //user1 first deposits Ether
            await exchange.depositEther({ from: user1, value: ether(1) })
            // give tokens to user2
            await token.transfer(user2, tokens(100), { from: deployer })
            //user2 deposits tokens
            await token.approve(exchange.address, tokens(2), { from: user2 })
            await exchange.depositToken(token.address, tokens(2), { from: user2 })
            //user1 makes an order to buy tokens with Ether
            await exchange.makeOrder(token.address, tokens(1), ETHER_ADDRESS, ether(1), { from: user1 })
        })

        describe('filling orders', async () => {
            let result

            describe('success', async () => {
                beforeEach(async () => {
                    //user2 fills order
                    result = await exchange.fillOrder('1', { from: user2 })
                })

                it('executes trade & charges fee', async () => {
                    let balance
                    balance = await exchange.balanceOf(token.address, user1) //balance of token for user1
                    balance.toString().should.equal(tokens(1).toString(), 'user1 received tokens') //user1 should have received 1 token
                    balance = await exchange.balanceOf(ETHER_ADDRESS, user2) //balance of Ether for user2
                    balance.toString().should.equal(ether(1).toString(), 'user2 received Ether') //user2 should have received 1 ether
                    balance = await exchange.balanceOf(ETHER_ADDRESS, user1) //balance of Ether for user1
                    balance.toString().should.equal('0', 'user1 Ether deducted') //user1 should have had 1 ether deducted
                    balance = await exchange.balanceOf(token.address, user2) //balance of tokens for user2
                    balance.toString().should.equal(tokens(0.9).toString(), 'user2 tokens deducted with fee') //tokens deducted from user2, including fee. 0.9 tokens remaining
                    const feeAccount = await exchange.feeAccount()
                    balance = await exchange.balanceOf(token.address, feeAccount) //balance of feeAccount
                    balance.toString().should.equal(tokens(0.1).toString(), 'feeAccount received fee') //ensure feeAccount received proper fee (10% fee)
                })

                it('updates filled orders (orderFilled mapping)', async () => {
                    const orderFilled = await exchange.orderFilled(1)
                    orderFilled.should.equal(true)
                })

                it('emits a Trade event', async () => {
                    const log = result.logs[0]
                    log.event.should.equal('Trade')
                    const event = log.args
                    event.id.toString().should.equal('1', 'id is correct')
                    event.user.should.equal(user1, 'user is correct')
                    event.tokenGet.should.equal(token.address, 'tokenGet is correct')
                    event.amountGet.toString().should.equal(tokens(1).toString(), 'amountGet is correct')
                    event.tokenGive.should.equal(ETHER_ADDRESS, 'tokenGive is correct')
                    event.amountGive.toString().should.equal(ether(1).toString(), 'amountGive is correct')
                    event.userFill.should.equal(user2, 'userFill is correct')
                    event.timestamp.toString().length.should.be.at.least(1, 'timestamp is present') 
                })
            })

            describe('failure', async () => {

                it('rejects invalid order ids', async () => {
                    //ensure we can't fill an invalid order
                    const invalidOrderId = 99999
                    await exchange.fillOrder(invalidOrderId, { from: user2}).should.be.rejectedWith(EVM_REVERT)
                })

                it('rejects already-filled orders', async () => {
                    //fill the order
                    await exchange.fillOrder('1', {from: user2 }).should.be.fulfilled
                    //try to fill the order again
                    await exchange.fillOrder('1', {from: user2 }).should.be.rejectedWith(EVM_REVERT)
                })

                it('rejects cancalled orders', async () => {
                    //cancel the order
                    await exchange.cancelOrder('1', { from: user1 }).should.be.fulfilled
                    //try filling cancelled order
                    await exchange.fillOrder('1', { from: user2 }).should.be.rejectedWith(EVM_REVERT)
                })
            })
        })

        describe('cancelling orders', async () => {
            let result

            describe('success', async () => {
                beforeEach(async () => {
                    // try to cancel order
                    result = await exchange.cancelOrder('1', { from: user1 })
                })

                it('updates cancelled orders', async () => {
                    // ensure it was cancelled
                    const orderCancelled = await exchange.orderCancelled(1)
                    orderCancelled.should.equal(true)
                })

                it('emits a Cancel event', async () => {
                    const log = result.logs[0]
                    log.event.should.equal('Cancel')
                    const event = log.args
                    event.id.toString().should.equal('1', 'id is correct')
                    event.user.should.equal(user1, 'user is correct')
                    event.tokenGet.should.equal(token.address, 'tokenGet is correct')
                    event.amountGet.toString().should.equal(tokens(1).toString(), 'amountGet is correct')
                    event.tokenGive.should.equal(ETHER_ADDRESS, 'tokenGive is correct')
                    event.amountGive.toString().should.equal(ether(1).toString(), 'amountGive is correct')
                    event.timestamp.toString().length.should.be.at.least(1, 'timestamp is present') 
                })

            })

            describe('failure', async () => {
                it('rejects invalid order ids', async () => {
                    const invalidOrderId = 99999
                    //can't cancel order that doesn't exist
                    await exchange.cancelOrder(invalidOrderId, { from: user1 }).should.be.rejectedWith(EVM_REVERT)
                })

                it('rejects unauthorized cancelations', async () => {
                    //try to cancel order you didn't create
                    await exchange.cancelOrder('1', { from: user2 }).should.be.rejectedWith(EVM_REVERT)
                })
            })
        })
    })
})