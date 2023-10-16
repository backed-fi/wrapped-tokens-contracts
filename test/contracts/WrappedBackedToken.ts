import { ethers } from "hardhat";
import { Signer } from "ethers";
import { SignerWithAddress, cacheBeforeEach, mineBlocks } from "../helpers";
import { expect } from "chai";
import { ERC20Mock, ERC20Mock__factory, ERC20__factory, WhitelistController, WhitelistControllerAggregator__factory, WhitelistController__factory, WrappedBackedToken, WrappedBackedTokenFactory, WrappedBackedTokenFactory__factory, WrappedBackedToken__factory } from "../../typechain-types";

describe("WrappedBackedToken", function () {

  let accounts: Signer[];

  let owner: SignerWithAddress;
  let actor: SignerWithAddress;
  let initializer: SignerWithAddress;

  let factory: WrappedBackedTokenFactory;
  let baseToken: ERC20Mock;
  let token: WrappedBackedToken;


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
    factory = await new WrappedBackedTokenFactory__factory(owner.signer).deploy(
      owner.address
    );
  });

  describe('#initialize', () => {
    const subject = async () => {
      const address = await factory.deployWrappedToken.staticCall(await baseToken.getAddress(), owner.address);
      await factory.deployWrappedToken(await baseToken.getAddress(), owner.address)
      return WrappedBackedToken__factory.connect(address, owner.signer)
    };

    it('should set symbol with `w` prefix', async () => {
      const token = await subject()
      expect(await token.symbol()).to.eq('wTOK')
    })

    it('should set name with `Wrapped ` prefix', async () => {
      const token = await subject()
      expect(await token.name()).to.eq('Wrapped Token Name')
    })
    it('should revert if attempt to call second time', async () => {
      const token = await subject()
      await expect(token.initialize(baseToken.getAddress())).to.be.reverted
    })
  })

  describe('methods', () => {
    let token: WrappedBackedToken;
    let controller: WhitelistController;
    cacheBeforeEach(async () => {
      const address = await factory.deployWrappedToken.staticCall(await baseToken.getAddress(), owner.address);
      await factory.deployWrappedToken(await baseToken.getAddress(), owner.address)
      token = WrappedBackedToken__factory.connect(address, owner.signer)
      const controllerAggregator = WhitelistControllerAggregator__factory.connect(await factory.whitelistControllerAggregator(), owner.signer);
      controller = WhitelistController__factory.connect(await controllerAggregator.controllers(0), owner.signer)
      await controller.add([owner.address, actor.address]);
    })
    describe('#depositFor', () => {
      let amount: bigint;
      let recipient: string;
      cacheBeforeEach(async() => {
        amount = 10n ** 18n
        recipient = actor.address
        await baseToken.mint(recipient, amount)
      })
      const subject = async () => {
        await baseToken.connect(actor.signer).approve(token, amount)
        return token.connect(actor.signer).depositFor(recipient, amount)
      };

      it('should increase balance of token to deposited amount', async () => {
        await subject()
        expect(await token.balanceOf(actor.address)).to.eq(amount)
      })
      it('should increase underlying balance of token', async () => {
        await subject()
        expect(await baseToken.balanceOf(token)).to.eq(amount)
      })
      it('should reject for non whitelisted recipient', async () => {
        await controller.remove([actor.address]);
        await expect(subject()).to.be.reverted
      })
    })

    describe('#withdrawTo', () => {
      let initialAmount: bigint;
      let amount: bigint;
      let recipient: string;
      cacheBeforeEach(async() => {
        initialAmount = 10n ** 18n
        recipient = actor.address
        await baseToken.mint(recipient, initialAmount)
        await baseToken.connect(actor.signer).approve(token, initialAmount)
        await token.connect(actor.signer).depositFor(recipient, initialAmount)
        amount = initialAmount / 2n;
      })
      const subject = async () => {
        return token.connect(actor.signer).withdrawTo(recipient, amount)
      };

      it('should decrease balance by requested amount', async () => {
        await subject()
        expect(await token.balanceOf(actor.address)).to.eq(initialAmount - amount)
      })
      it('should increase balance of underlying for given user', async () => {
        await subject()
        expect(await baseToken.balanceOf(actor.address)).to.eq(amount)
      })
      it('should decrease underlying balance of token', async () => {
        await subject()
        expect(await baseToken.balanceOf(token)).to.eq(initialAmount - amount)
      })
      it('should reject for non whitelisted owner', async () => {
        await controller.remove([actor.address]);
        await expect(subject()).to.be.reverted
      })
    })
    describe('#transfer', () => {
      let amount: bigint;
      let recipient: string;
      cacheBeforeEach(async() => {
        amount = 10n ** 18n
        recipient = owner.address
        await baseToken.mint(actor.address, amount)
        await baseToken.connect(actor.signer).approve(token, amount)
        await token.connect(actor.signer).depositFor(actor.address, amount)
      })
      const subject = async () => {
        return token.connect(actor.signer).transfer(recipient, amount)
      };

      it('should allow for whitelisted addresses', async () => {
        await expect(subject()).to.not.be.reverted
      })
      it('should reject for non whitelisted sender', async () => {
        await controller.remove([actor.address]);
        await expect(subject()).to.be.reverted
      })
      it('should reject for non whitelisted recipient', async () => {
        await controller.remove([owner.address]);
        await expect(subject()).to.be.reverted
      })
      it('should reject when contract is paused', async () => {
        await token.pause();
        await expect(subject()).to.be.reverted
      })
      it('should work if controller is set to zero address', async () => {
        await token.setWhitelistController(ethers.ZeroAddress);
        await expect(subject()).to.not.be.reverted
      })
    })
    describe('#decimals', () => {
      const subject = async () => {
        return token.decimals()
      };

      it('should return decimals of base token', async () => {
        expect(await subject()).to.be.eq(await baseToken.decimals())
      })
    })
    describe('#pause', () => {
      const subject = async () => {
        return token.pause()
      };

      it('should revert for non owner address', async () => {
        await token.transferOwnership(actor.address)
        await expect(subject()).to.be.reverted
      })
      it('should set pause state to true', async () => {
        await subject()
        expect(await token.paused()).to.be.eq(true)
      })
    })
    describe('#unpause', () => {
      cacheBeforeEach(async () => {
        await token.pause()
      })
      const subject = async () => {
        return token.unpause()
      };

      it('should revert for non owner address', async () => {
        await token.transferOwnership(actor.address)
        await expect(subject()).to.be.reverted
      })
      it('should set pause state to false', async () => {
        await subject()
        expect(await token.paused()).to.be.eq(false)
      })
    })
    describe('#setWhitelistController', () => {
      const subject = async (whitelistController: string) => {
        return token.setWhitelistController(whitelistController)
      };

      it('should revert for non owner address', async () => {
        await token.transferOwnership(actor.address)
        await expect(subject('0x0000000000000000000000000000000000000001')).to.be.reverted
      })
      it('should set controller to requested address', async () => {
        const requestedAddress = '0x0000000000000000000000000000000000000001';
        await subject(requestedAddress)
        expect(await token.whitelistControllerAggregator()).to.be.eq(requestedAddress)
      })
    })
  })
});