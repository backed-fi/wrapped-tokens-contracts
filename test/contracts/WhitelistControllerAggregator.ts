import { ethers } from "hardhat";
import { Signer } from "ethers";
import { SignerWithAddress, cacheBeforeEach } from "../helpers";
import { expect } from "chai";
import { WhitelistController, WhitelistControllerAggregator, WhitelistControllerAggregator__factory, WhitelistController__factory, WrappedBackedTokenFactory__factory } from "../../typechain-types";

describe("WhitelistControllerAggregator", function () {

  let accounts: Signer[];

  let owner: SignerWithAddress;

  let aggregator: WhitelistControllerAggregator;
  let defaultController: WhitelistController;


  cacheBeforeEach(async () => {
    accounts = await ethers.getSigners();
    const getSigner = async (index: number): Promise<SignerWithAddress> => ({
      signer: accounts[index],
      address: await accounts[index].getAddress(),
    });

    owner = await getSigner(0)

    const factory = await new WrappedBackedTokenFactory__factory(owner.signer).deploy(
      owner.address
    );
    const aggregatorAddress = await factory.whitelistControllerAggregator();
    aggregator = WhitelistControllerAggregator__factory.connect(aggregatorAddress, owner.signer)
    defaultController = WhitelistController__factory.connect(await aggregator.controllers(0), owner.signer)
  });

  describe('#initialize', () => {
    it('should revert if attempt to call second time', async () => {
      await expect(aggregator.initialize()).to.be.reverted
    })
  })

  describe('methods', () => {
    describe('#add', () => {
      const subject = async (address: string) => {
        return aggregator.add(address)
      };

      it('should return new controller on latest index', async () => {
        const controllerAddress = '0x0000000000000000000000000000000000000001';
        await subject(controllerAddress)
        expect(await aggregator.controllers(1)).to.eq(controllerAddress)
      })
      it('should revert if called not by owner', async () => {
        const controllerAddress = '0x0000000000000000000000000000000000000001';
        await aggregator.transferOwnership(accounts[1].getAddress())
        await expect(subject(controllerAddress)).to.be.reverted
      })
    })
    describe('#remove', () => {
      const controllerAddress = '0x0000000000000000000000000000000000000001';
      cacheBeforeEach(async() => {
        await aggregator.add(controllerAddress)
      })
      const subject = async (index: number) => {
        return aggregator.remove(index)
      };

      it('should delete last index when requested', async () => {
        await subject(1)
        await expect(aggregator.controllers(1)).to.be.rejected
      })
      it('should move controller from last index to deleted one', async () => {
        await subject(0)
        expect(await aggregator.controllers(0)).to.eq(controllerAddress)
      })
      it('should revert if called not by owner', async () => {
        await aggregator.transferOwnership(accounts[1].getAddress())
        await expect(subject(0)).to.be.reverted
      })
    })
    describe('#isWhitelisted', () => {
      cacheBeforeEach(async() => {
        await defaultController.add([owner.address])
      })
      const subject = async (address: string) => {
        return aggregator.isWhitelisted(address)
      };

      it('should return true for whitelisted call when underlying controller has given address whitelisted', async () => {
        await subject(owner.address)
        expect(await aggregator.isWhitelisted(owner.address)).to.eq(true)
      })
    })
  })
});