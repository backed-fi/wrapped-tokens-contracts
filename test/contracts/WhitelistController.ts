import { ethers } from "hardhat";
import { Signer } from "ethers";
import { SignerWithAddress, cacheBeforeEach } from "../helpers";
import { expect } from "chai";
import { WhitelistController, WhitelistControllerAggregator__factory, WhitelistController__factory, WrappedBackedTokenFactory__factory } from "../../typechain-types";

describe("WhitelistController", function () {

  let accounts: Signer[];

  let owner: SignerWithAddress;
  let actor: SignerWithAddress;

  let controller: WhitelistController;


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
    const aggregator = await factory.whitelistControllerAggregator();
    const controllerAddress = await WhitelistControllerAggregator__factory.connect(aggregator, owner.signer).controllers(0)
    controller = WhitelistController__factory.connect(controllerAddress, owner.signer)
  });

  describe('#initialize', () => {
    it('should revert if attempt to call second time', async () => {
      await expect(controller.initialize()).to.be.reverted
    })
  })

  describe('methods', () => {
    describe('#add', () => {
      const subject = async (addresses: string[]) => {
        return controller.add(addresses)
      };

      it('should return true for isWhitelisted call for each added address', async () => {
        await subject([owner.address, actor.address])
        expect(await controller.isWhitelisted(owner.address)).to.eq(true)
        expect(await controller.isWhitelisted(actor.address)).to.eq(true)
      })
      it('should revert if called not by owner', async () => {
        await controller.transferOwnership(accounts[1].getAddress())
        await expect(subject([owner.address])).to.be.reverted
      })
    })
    describe('#remove', () => {
      cacheBeforeEach(async() => {
        await controller.add([owner.address, actor.address])
      })
      const subject = async (addresses: string[]) => {
        return controller.remove(addresses)
      };

      it('should return false for isWhitelisted call for each removed address', async () => {
        await subject([owner.address, actor.address])
        expect(await controller.isWhitelisted(owner.address)).to.eq(false)
      })
      it('should revert if called not by owner', async () => {
        await controller.transferOwnership(accounts[1].getAddress())
        await expect(subject([owner.address])).to.be.reverted
      })
    })
  })
});