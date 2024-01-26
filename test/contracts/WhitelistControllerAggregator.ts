import { ethers } from "hardhat";
import { Signer } from "ethers";
import { SignerWithAddress, cacheBeforeEach } from "../helpers";
import { expect } from "chai";
import { WhitelistController, WhitelistControllerAggregator, WhitelistControllerAggregator__factory, WhitelistController__factory, WrappedBackedTokenFactory__factory } from "../../typechain-types";

describe("WhitelistControllerAggregator", function () {

  let accounts: Signer[];

  let owner: SignerWithAddress;
  let actor: SignerWithAddress;

  let aggregator: WhitelistControllerAggregator;
  let defaultController: WhitelistController;


  cacheBeforeEach(async () => {
    accounts = await ethers.getSigners();
    const getSigner = async (index: number): Promise<SignerWithAddress> => ({
      signer: accounts[index],
      address: await accounts[index].getAddress(),
    });

    owner = await getSigner(0)
    actor = await getSigner(1)

    const factory = await new WrappedBackedTokenFactory__factory(owner.signer).deploy(
      owner.address
    );
    const aggregatorAddress = await factory.whitelistControllerAggregator();
    aggregator = WhitelistControllerAggregator__factory.connect(aggregatorAddress, owner.signer)
    await aggregator.setCallerAdmin(owner.address, true)
    await aggregator.setCaller(owner.address, true);
    defaultController = WhitelistController__factory.connect(await aggregator.controllers(0), owner.signer)
  });

  describe('#initialize', () => {
    it('should revert if attempt to call second time', async () => {
      await expect(aggregator.initialize()).to.be.reverted
    })
  })

  describe('methods', () => {
    describe('#setCallerAdmin', () => {
      const subject = async (address: string, value: boolean) => {
        return aggregator.setCallerAdmin(address, value)
      };

      it('should make given address the admin', async () => {
        const address = '0x0000000000000000000000000000000000000001';
        await subject(address, true)
        expect(await aggregator.isCallerAdmin(address)).to.eq(true)
      })
      it('should unmark given address as admin', async () => {
        const address = '0x0000000000000000000000000000000000000001';
        await subject(address, true)
        await subject(address, false)
        expect(await aggregator.isCallerAdmin(address)).to.eq(false)
      })
      it('should revert if called not by owner', async () => {
        const address = '0x0000000000000000000000000000000000000001';
        await aggregator.transferOwnership(accounts[1].getAddress())
        await expect(subject(address, true)).to.be.reverted
      })
    })
    describe('#setCaller', () => {
      cacheBeforeEach(async () => {
        await aggregator.setCallerAdmin(owner.address, true)
      })
      const subject = async (address: string, value: boolean) => {
        return aggregator.setCaller(address, value)
      };

      it('should make given address the caller', async () => {
        const address = '0x0000000000000000000000000000000000000001';
        await subject(address, true)
        expect(await aggregator.isAuthorizedCaller(address)).to.eq(true)
      })
      it('should unmark given address as caller', async () => {
        const address = '0x0000000000000000000000000000000000000001';
        await subject(address, true)
        await subject(address, false)
        expect(await aggregator.isAuthorizedCaller(address)).to.eq(false)
      })
      it('should revert if called not by admin', async () => {
        const address = '0x0000000000000000000000000000000000000001';
        await aggregator.setCallerAdmin(owner.address, false)
        await expect(subject(address, true)).to.be.reverted
      })
    })
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

      it('should reject for non authorized caller', async () => {
        await expect(aggregator.connect(actor.signer).isWhitelisted(actor.address)).to.be.rejectedWith("Not authorized")
      })
      it('should return true and address of whitelist controller for whitelisted call when underlying controller has given address whitelisted', async () => {
        await subject(owner.address)
        const result = await aggregator.isWhitelisted.staticCall(owner.address);
        expect(result.isWhitelisted).to.eq(true)
        expect(result.whitelistController).to.eq(await defaultController.getAddress())
      })
    })
  })
});