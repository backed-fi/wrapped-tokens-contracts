import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-chai-matchers";
import 'dotenv/config';
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      "outputSelection": {
        "*": {
          "*": [
            "metadata", // <--
            "evm.bytecode",
            "evm.bytecode.sourceMap"
          ],
        }
      }
    }
  },
  networks: {
    hardhat: {
      forking: { url: 'https://gateway.tenderly.co/public/polygon-mumbai' },
      allowUnlimitedContractSize: true
    },
    localhost: {
      url: 'http://localhost:8545'
    },
    mumbai: {
      url: 'https://gateway.tenderly.co/public/polygon-mumbai',
      accounts: [process.env.MUMBAI_PK!]
    }
  }
};

export default config;
