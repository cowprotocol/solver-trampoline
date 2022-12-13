import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("SolverTrampoline", function () {
  async function fixture() {
    const SolverTrampoline = await ethers.getContractFactory("SolverTrampoline");
    const solverTrampoline = await SolverTrampoline.deploy();

    const { chainId } = await ethers.provider.getNetwork();
    const domain = {
      chainId,
      verifyingContract: solverTrampoline.address,
    };

    return { solverTrampoline, domain };
  }

  describe("Deployment", function () {
    it("Should have an address", async function () {
      const { solverTrampoline } = await loadFixture(fixture);

      expect(solverTrampoline.address)
        .to.not.equal(ethers.constants.AddressZero);
    });
  });

  describe("settlementMessage", function () {
    it("Should have a well defined domain separator", async function () {
      const { solverTrampoline, domain } = await loadFixture(fixture);

      expect(await solverTrampoline.domainSeparator())
        .to.equal(ethers.utils._TypedDataEncoder.hashDomain(domain));
    });

    it("Should compute a EIP-712 message for signing", async function () {
      const { solverTrampoline, domain } = await loadFixture(fixture);
      const settlement = "0x01020304";
      const nonce = 42;

      expect(await solverTrampoline.settlementMessage(settlement, nonce))
        .to.equal(
          ethers.utils._TypedDataEncoder.hash(domain, EIP712_TYPES, {
            settlement,
            nonce,
          }),
        );
    });
  });
});

const EIP712_TYPES = {
  Settlement: [
    { name: "settlement", type: "bytes" },
    { name: "nonce", type: "uint256" },
  ],
};
