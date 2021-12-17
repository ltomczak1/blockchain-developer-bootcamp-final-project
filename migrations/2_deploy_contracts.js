//pull in token
const Token = artifacts.require("Token");
//pull in exchange
const Exchange = artifacts.require("Exchange");


module.exports = async function (deployer) {
  //get array of all eth accounts
  const accounts = await web3.eth.getAccounts()

  //deploy token
  await deployer.deploy(Token);

  //deploy exchange
  const feeAccount = accounts[0]
  const feePercent = 10
  await deployer.deploy(Exchange, feeAccount, feePercent);
};
