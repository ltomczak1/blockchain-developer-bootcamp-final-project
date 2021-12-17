//Ether Address
export const ETHER_ADDRESS = '0x0000000000000000000000000000000000000000'

//EVM Error Message
export const EVM_REVERT = 'VM Exception while processing transaction: revert'

//refactor tokens to not type out all decimal places
export const ether = (n) => {
    return new web3.utils.BN(
        web3.utils.toWei(n.toString(), 'ether')
    )
}

//same as ether
export const tokens = (n) => ether(n)