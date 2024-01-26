import { ethers } from "hardhat";
import { Signer } from "ethers";
import { SignerWithAddress, cacheBeforeEach } from "../helpers";
import { expect } from "chai";
import { KeyringCredentialsMock, KeyringCredentialsMock__factory, KeyringWhitelistControllerAdapter, KeyringWhitelistControllerAdapter__factory, PolicyManagerMock, PolicyManagerMock__factory, WhitelistController, WhitelistControllerAggregator__factory, WhitelistController__factory, WrappedBackedTokenFactory__factory } from "../../typechain-types";

describe("KeyringWhitelistControllerAdapter", function () {

  let accounts: Signer[];

  let owner: SignerWithAddress;
  let actor: SignerWithAddress;

  let controller: KeyringWhitelistControllerAdapter;
  let keyringCredentialsMock: KeyringCredentialsMock;
  let policyManagerMock: PolicyManagerMock;


  cacheBeforeEach(async () => {
    accounts = await ethers.getSigners();
    const getSigner = async (index: number): Promise<SignerWithAddress> => ({
      signer: accounts[index],
      address: await accounts[index].getAddress(),
    });

    owner = await getSigner(0)
    actor = await getSigner(1)
    keyringCredentialsMock = await new KeyringCredentialsMock__factory(owner.signer).deploy()
    policyManagerMock = await new PolicyManagerMock__factory(owner.signer).deploy()
    await policyManagerMock.setPolicyTtl(1000);
    controller = await new KeyringWhitelistControllerAdapter__factory(owner.signer).deploy(
      owner.address,
      keyringCredentialsMock.getAddress(),
      policyManagerMock.getAddress(),
      3
    );
  });

  describe('methods', () => {
    describe('#isWhitelisted', () => {
      const subject = async (address: string) => {
        return controller.isWhitelisted.staticCall(address)
      };

      it('should return true for address with fresh update', async () => {
        await keyringCredentialsMock.setSubjectUpdates(Math.floor(Date.now()/1000) - 10);
        expect(await subject(actor.address)).to.eq(true)
      })
      it('should return false for address with expired update', async () => {
        await keyringCredentialsMock.setSubjectUpdates(Math.floor(Date.now()/1000) - 1500);
        expect(await subject(actor.address)).to.eq(false)
      })
      it('should return false for address with no update', async () => {
        await keyringCredentialsMock.setSubjectUpdates(0);
        expect(await subject(actor.address)).to.eq(false)
      })
      it('should reject for non authorized caller', async () => {
        await expect(controller.connect(actor.signer).isWhitelisted(actor.address)).to.be.rejectedWith("Not authorized")
      })
    })
  })
});