import { ethers } from "hardhat";
import { Signer } from 'ethers';
import { SignerWithAddress } from "../test/helpers";
import { WrappedBackedTokenFactory, WrappedBackedTokenFactory__factory } from "../typechain-types";

async function main() {

  let accounts: Signer[];

  let owner: SignerWithAddress;
  let wrappedTokenFactory: WrappedBackedTokenFactory;


  accounts = await ethers.getSigners();

  // Initialize environment

  // Setup used accounts
  const getSigner = async (index: number): Promise<SignerWithAddress> => ({
    signer: accounts[index],
    address: await accounts[index].getAddress(),
  });
  owner = await getSigner(0);

  accounts = await ethers.getSigners();

  // Deploy system

  // Deploy wrapped token factory
  wrappedTokenFactory = await (
    await new WrappedBackedTokenFactory__factory(owner.signer).deploy(owner.address)
  ).waitForDeployment();

  const state = {
    factory: await wrappedTokenFactory.getAddress()
  }
  console.log(state)

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
