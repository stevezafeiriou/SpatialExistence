require("@nomiclabs/hardhat-ethers");
require("dotenv").config();

module.exports = {
	defaultNetwork: "localhost",
	networks: {
		localhost: {
			url: "http://127.0.0.1:8545",
			chainId: 31337,
			// accounts: [process.env.PRIVATE_KEY],
		},
	},
	solidity: {
		compilers: [
			{
				version: "0.8.20",
				settings: { optimizer: { enabled: true, runs: 200 } },
			},
		],
	},
};
