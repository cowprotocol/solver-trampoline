import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { BigNumberish, BytesLike, Signer } from "ethers";
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

    async function signTestSettlement(
      signer: Signer,
      nonce: BigNumberish,
      options?: { shouldRevert: boolean },
    ): Promise<{
      settlement: BytesLike;
      r: BytesLike;
      s: BytesLike;
      v: BigNumberish;
    }> {
      const { shouldRevert } = options ?? { shouldRevert: false };
      const settlement = TestSettlement.interface.encodeFunctionData(
        "doSomething",
        [shouldRevert],
      );
      // This function is missing from the signer interface, but it is there...
      const signature = await (signer as any)._signTypedData(
        domain,
        EIP712_TYPES,
        { settlement, nonce },
      );

      return {
        settlement,
        ...ethers.utils.splitSignature(signature),
      };
    }

    return {
      solver,
      notSolver,
      settlementContract,
      solverAuthenticator,
      solverTrampoline,
      domain,
      signTestSettlement,
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

  describe("settle", function () {
    it("Should execute a settlement and increment nonce", async function () {
      const { solverTrampoline, signTestSettlement, solver } =
        await loadFixture(fixture);

      const nonce = await solverTrampoline.nonces(solver.address);
      const {
        settlement,
        r,
        s,
        v,
      } = await signTestSettlement(solver, nonce);

      await expect(solverTrampoline.settle(settlement, nonce, r, s, v))
        .to.emit(solverTrampoline, "TrampolinedSettlement")
        .withArgs(solver.address, nonce);
      expect(await solverTrampoline.nonces(solver.address))
        .to.equal(nonce.add(1));
    });

    it("Should propagate settlement reverts", async function () {
      const { solverTrampoline, signTestSettlement, solver } =
        await loadFixture(fixture);

      const nonce = await solverTrampoline.nonces(solver.address);
      const {
        settlement,
        r,
        s,
        v,
      } = await signTestSettlement(solver, nonce, { shouldRevert: true });

      await expect(solverTrampoline.settle(settlement, nonce, r, s, v))
        .to.be.revertedWith("test settlement reverted");
    });

    it("Should deny settlements with invalid signatures", async function () {
      const { solverTrampoline } = await loadFixture(fixture);

      const { r, s, v } = INVALID_SIGNATURE;
      await expect(solverTrampoline.settle("0x", 0, r, s, v))
        .to.be.reverted;
    });

    it("Should deny settlements signed unauthorized solvers", async function () {
      const { solverTrampoline, signTestSettlement, notSolver } =
        await loadFixture(fixture);

      const nonce = await solverTrampoline.nonces(notSolver.address);
      const {
        settlement,
        r,
        s,
        v,
      } = await signTestSettlement(notSolver, nonce);

      await expect(solverTrampoline.settle(settlement, nonce, r, s, v))
        .to.be.reverted;
    });

    it("Should deny settlements with incorrect nonces", async function () {
      const { solverTrampoline, signTestSettlement, solver } =
        await loadFixture(fixture);

      const nonce = await solverTrampoline.nonces(solver.address);
      const wrongNonce = nonce.add(1);
      const {
        settlement,
        r,
        s,
        v,
      } = await signTestSettlement(solver, wrongNonce);

      await expect(solverTrampoline.settle(settlement, wrongNonce, r, s, v))
        .to.be.reverted;
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

// NOTE: According to the yellow paper, a `v` value that is not 27 or 28 is
// considered to be "incorrect" input and causes the pre-compile to fail, which
// translates to `ecrecover` returning the 0-address in Solidity.
const INVALID_SIGNATURE = {
  r: ethers.constants.HashZero,
  s: ethers.constants.HashZero,
  v: 42,
};
