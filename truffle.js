var sign = require('ethjs-signer').sign;
var SignerProvider = require('ethjs-provider-signer');

// fix 
SignerProvider.prototype.send = function(payload){
  throw new Error('SignerProvider does not support synchronous requests.')
};

module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // for more about customizing your Truffle configuration!
  solc: { optimizer: { enabled: true, runs: 400 } },
  
  networks: {
    development: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*",
      gas: 4700000,
      gasPrice: 2 * 1000000000
    },
    rinkeby: {
      network_id: "*", // Match any network id
      gas: 4712388,
      gasPrice: 2 * 1000000000,
      provider: function() {
        var account = "";
        var privateKey = "";

        return new SignerProvider("https://rinkeby.infura.io/mew", {
          signTransaction: (rawTx, cb) => cb(null, sign(rawTx, privateKey)),
          accounts: (cb) => cb(null, [account]),
        });
      }
    },
    eth: {
      network_id: "*", // Match any network id
      gas: 4700000,
      gasPrice: 2 * 1000000000,
      provider: function() {
          var account = "";
          var privateKey = "";

          return new SignerProvider("https://api.myetherapi.com/eth", {
              signTransaction: (rawTx, cb) => cb(null, sign(rawTx, privateKey)),
              accounts: (cb) => cb(null, [account]),
        });
      }
    }
  }
};