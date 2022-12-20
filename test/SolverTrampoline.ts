import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("SolverTrampoline", function () {
  async function fixture() {
    const [deployer, solver, notSolver] = await ethers.getSigners();

    const TestSettlement = await ethers.getContractFactory("TestSettlement");
    const settlementContract = await TestSettlement
      .connect(deployer)
      .deploy(solver.address);
    const TestAuthentication = await ethers.getContractFactory("TestAuthentication");
    const solverAuthenticator = TestAuthentication
      .connect(deployer)
      .attach(await settlementContract.authenticator());

    const SolverTrampoline = await ethers.getContractFactory("SolverTrampoline");
    const solverTrampoline = await SolverTrampoline
      .connect(deployer)
      .deploy(settlementContract.address);

    const { chainId } = await ethers.provider.getNetwork();
    const domain = {
      chainId,
      verifyingContract: solverTrampoline.address,
    };

    return {
      solver,
      notSolver,
      settlementContract,
      solverAuthenticator,
      solverTrampoline,
      domain,
    };
  }

  describe("Deployment", function () {
    it("Should have an address", async function () {
      const { solverTrampoline } = await loadFixture(fixture);

      expect(solverTrampoline.address)
        .to.not.equal(ethers.constants.AddressZero);
    });

    it("Should set CoW Protocol contract addresses", async function () {
      const { settlementContract, solverAuthenticator, solverTrampoline } =
        await loadFixture(fixture);

      expect(await solverTrampoline.settlementContract())
        .to.equal(settlementContract.address);
      expect(await solverTrampoline.solverAuthenticator())
        .to.equal(solverAuthenticator.address);
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
