import { ethers } from "hardhat";
import { Signer } from "ethers";
import { SignerWithAddress, cacheBeforeEach, mineBlocks } from "../helpers";
import { expect } from "chai";
import { ERC20Mock, ERC20Mock__factory, ERC20__factory, WhitelistControllerAggregator__factory, WhitelistController__factory, WrappedBackedTokenFactory, WrappedBackedTokenFactory__factory, WrappedBackedToken__factory } from "../../typechain-types";

describe("WrappedBackedTokenFactory", function () {

  let accounts: Signer[];

  let owner: SignerWithAddress;
  let actor: SignerWithAddress;
  let initializer: SignerWithAddress;

  let factory: WrappedBackedTokenFactory;
  let baseToken: ERC20Mock;


  cacheBeforeEach(async () => {
    accounts = await ethers.getSigners();
    const getSigner = async (index: number): Promise<SignerWithAddress> => ({
      signer: accounts[index],
      address: await accounts[index].getAddress(),
    });

    owner = await getSigner(0)
    initializer = await getSigner(1)
    actor = await getSigner(2)

    baseToken = await new ERC20Mock__factory(owner.signer).deploy(
      "Token Name",
      "TOK"
    );
  });

  describe('#constructor', () => {
    const subject = (proxyAdminOwner: string = owner.address) => new WrappedBackedTokenFactory__factory(owner.signer).deploy(
      proxyAdminOwner
    );
    it('should revert if proxyAdminOwner set to zero', async () => {

      await expect(subject(ethers.ZeroAddress)).to.be.reverted
    })
    it('should set owner to creator', async () => {
      const factory = await subject()
      expect(await factory.owner()).to.eq(owner.address)
    })

    it('should create controller aggregator', async () => {
      const factory = await subject()
      const aggregator = await factory.whitelistControllerAggregator();
      await expect(WhitelistControllerAggregator__factory.connect(aggregator, owner.signer).controllers(0)).to.not.be.rejected
      expect(await WhitelistControllerAggregator__factory.connect(aggregator, owner.signer).owner()).to.eq(owner.address)
    })

    it('should set add single controller to aggregator', async () => {
      const factory = await subject()
      const aggregator = await factory.whitelistControllerAggregator();
      const controllerAddress = await WhitelistControllerAggregator__factory.connect(aggregator, owner.signer).controllers(0)
      const controller = WhitelistController__factory.connect(controllerAddress, owner.signer)
      expect(await controller.owner()).to.eq(owner.address);
      expect(await controller.isWhitelisted(owner.address)).to.eq(false);
    })

  })

  describe('when factory instance is created', () => {
    cacheBeforeEach(async () => {

      factory = await new WrappedBackedTokenFactory__factory(owner.signer).deploy(
        owner.address
      );
    });
    describe('#deployWrappedToken', () => {
      const subject = async () => {
        const address = await factory.deployWrappedToken.staticCall(await baseToken.getAddress(), owner.address);
        await factory.deployWrappedToken(await baseToken.getAddress(), owner.address)
        return WrappedBackedToken__factory.connect(address, owner.signer)
      };

      it('should revert if owner is set to different address', async () => {
        await factory.transferOwnership(actor.address);
        await expect(subject()).to.be.reverted;
      })
      it('should move ownership of token to given address', async () => {
        const token = await subject()
        expect(await token.owner()).to.eq(owner.address)
      })

      it('should set whitelist controller to shared controller aggregator', async () => {
        const token = await subject()
        expect(await token.whitelistControllerAggregator()).to.eq(await factory.whitelistControllerAggregator());
      })

    })

    describe('#updateImplementation', () => {
      let newImplementationAddress: string;
      const subject = () => {
        return factory.updateImplementation(newImplementationAddress)
      };

      it('should revert when zero address is passed', async () => {
        newImplementationAddress = ethers.ZeroAddress;
        await expect(subject()).to.be.reverted
      })

      describe('and new implementation is set', () => {
        beforeEach(() => {
          newImplementationAddress = '0x0000000000000000000000000000000000000001'
        })
        it('should revert if owner is set to different address', async () => {
          await factory.transferOwnership(actor.address);
          await expect(subject()).to.be.reverted;
        })

        it('should emit NewImplementation event', async () => {
          expect(await subject()).to.emit(factory, 'NewImplementation').withArgs(newImplementationAddress);
        })

        it('should set implementation address to requested address', async () => {
          await subject()
          expect(await factory.implementation()).to.be.eq(newImplementationAddress)
        })
      })

    })
    describe('#updateController', () => {
      let newControllerAddress: string;
      const subject = () => {
        return factory.updateController(newControllerAddress)
      };

      it('should revert when zero address is passed', async () => {
        newControllerAddress = ethers.ZeroAddress;
        await expect(subject()).to.be.reverted
      })

      describe('and new controller address is set', () => {
        beforeEach(() => {
          newControllerAddress = '0x0000000000000000000000000000000000000001'
        })
        it('should revert if owner is set to different address', async () => {
          await factory.transferOwnership(actor.address);
          await expect(subject()).to.be.reverted;
        })

        it('should emit NewController event', async () => {
          expect(await subject()).to.emit(factory, 'NewController').withArgs(newControllerAddress);
        })

        it('should set controller address to requested address', async () => {
          await subject()
          expect(await factory.whitelistControllerAggregator()).to.be.eq(newControllerAddress)
        })
      })

    })
  })
});