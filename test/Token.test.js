const { default: Web3 } = require('web3')

//Importing from helpers.js
import { tokens, EVM_REVERT } from './helpers'

const Token = artifacts.require('./Token')

require('chai')
    .use(require('chai-as-promised'))
    .should()


contract('Token', ([deployer, receiver, exchange]) => {
    const name = 'Consensys Blockchain Developer Bootcamp Token'
    const symbol = 'CBDT'
    const decimals = '18'
    const totalSupply = tokens(1000000).toString()
    let token

    //fetch token before each example
    beforeEach(async () => {
        token = await Token.new()
    })

    describe('Deployment', () => {
        it('tracks the name', async () => {
            // Read token name here
            const result = await token.name()
            // Check Token name is 'My Name'
            result.should.equal(name)
        })

        it('tracks the symbol', async () => {
            const result = await token.symbol()
            result.should.equal(symbol)
        })

        it('tracks the decimals', async () => {
            const result = await token.decimals()
            result.toString().should.equal(decimals)
        })

        it('tracks total token supply', async () => {
            const result = await token.totalSupply()
            result.toString().should.equal(totalSupply.toString())
        })

        it('Assigns total supply to the contract deployer', async () => {
            const result = await token.balanceOf(deployer)
            result.toString().should.equal(totalSupply.toString())
        })
    })

    describe('Token Transfers', () => {
        let result
        let amount

        describe('success', async () => {
            beforeEach(async () => {
                //Transfer
                amount = tokens(100)
                result = await token.transfer(receiver, amount, { from: deployer })
            })

            it('Transfers token balances', async () => {
                let balanceOf
                balanceOf = await token.balanceOf(deployer)
                balanceOf.toString().should.equal(tokens(999900).toString())
                balanceOf = await token.balanceOf(receiver)
                balanceOf.toString().should.equal(tokens(100).toString())
            })

            it('emits Transfer event', async () => {
                const log = result.logs[0]
                log.event.should.equal('Transfer')
                const event = log.args
                event.from.toString().should.equal(deployer, 'from value is correct')
                event.to.toString().should.equal(receiver, 'to value is correct')
                event.value.toString().should.equal(amount.toString(), 'value is correct')
            })
        })

        describe('failure', async () => {
            
            it('rejects insufficient balances', async () => {
                let invalidAmount
                invalidAmount = tokens(100000000) //greater than total supply
                await token.transfer(receiver, invalidAmount, {from: deployer }).should.be.rejectedWith(EVM_REVERT);
            })
            
            it('rejects transferring tokens when you have none', async () => { //troubleshoot this test
                //Attempt to transfer tokens when you have none (move to its own test?)
                let invalidAmount
                invalidAmount = tokens(10) //recipient has no tokens
                await token.transfer(deployer, invalidAmount, {from: receiver }).should.be.rejectedWith(EVM_REVERT);               
            })
            //cannot transfer to an invalid address
            it('rejects invalid recipients', async () => {
                await token.transfer(0x0, amount, { from: deployer }).should.be.rejected;
            })
        })
    })
    //approve tokens test
    describe('Approving tokens', () => {
        let result
        let amount

        beforeEach(async () => {
            amount = tokens(100)
            result = await token.approve(exchange, amount, { from: deployer })
        })

        describe('success', () => {
            it('Allocates an allowance for delegated token spending on exchange', async () => {
                const allowance = await token.allowance(deployer, exchange)
                allowance.toString().should.equal(amount.toString())
            })

            it('emits Approval event', async () => {
                const log = result.logs[0]
                log.event.should.equal('Approval')
                const event = log.args
                event.owner.toString().should.equal(deployer, 'owner is correct')
                event.spender.toString().should.equal(exchange, 'spender is correct')
                event.value.toString().should.equal(amount.toString(), 'value is correct')
            })
        })

        describe('failure', () => {
            it('rejects invalid spenders', async () => {
                await token.approve(0x0, amount, { from: deployer }).should.be.rejected
            })
        })
    })

    describe('Delegated Token Transfers', () => {
        let result
        let amount

        beforeEach(async () => {
            //approve 100 tokens to the exchange from deployer
            amount = tokens(100)
            await token.approve(exchange, amount, { from: deployer })
        })

        describe('success', async () => {
            beforeEach(async () => {
                //exchange will transfer from deployer to receiver in success case (approved above.)
                result = await token.transferFrom(deployer, receiver, amount, { from: exchange })
            })

            it('Exchange transfers token balances', async () => {
                let balanceOf
                balanceOf = await token.balanceOf(deployer)
                balanceOf.toString().should.equal(tokens(999900).toString())
                balanceOf = await token.balanceOf(receiver)
                balanceOf.toString().should.equal(tokens(100).toString())
            })

            it('Resets delegated token allowance', async () => {
                const allowance = await token.allowance(deployer, exchange)
                allowance.toString().should.equal('0')
            })

            it('emits Transfer event', async () => {
                const log = result.logs[0]
                log.event.should.equal('Transfer')
                const event = log.args
                event.from.toString().should.equal(deployer, 'from value is correct')
                event.to.toString().should.equal(receiver, 'to value is correct')
                event.value.toString().should.equal(amount.toString(), 'value is correct')
            })
        })

        describe('failure', async () => {
            it('rejects insufficient balances', async () => {
                //attempt to transfer too many tokens
                const invalidAmount = tokens(100000000) //greater than total supply & what exhcange is approved for
                await token.transferFrom(deployer, receiver, invalidAmount, { from: exchange }).should.be.rejectedWith(EVM_REVERT)
            })

            it('rejects invalid recipients', async () => {
                await token.transferFrom(deployer, 0x0, amount, { from: exchange }).should.be.rejected
            })
        })
    })
})