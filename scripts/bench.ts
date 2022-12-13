import { ethers } from "hardhat";

async function main() {
  const [solver] = await ethers.getSigners();

  const TestSettlement = await ethers.getContractFactory("TestSettlement");
  const settlementContract = await TestSettlement.deploy(solver.address);

  const SolverTrampoline = await ethers.getContractFactory("SolverTrampoline");
  const solverTrampoline = await SolverTrampoline.deploy(settlementContract.address);

  await solverTrampoline.deployed();

  const { chainId } = await ethers.provider.getNetwork();
  async function trampolineEmptyTestSettlement() {
    const emptySettlement = "0x";
    const nonce = await solverTrampoline.nonces(solver.address);
    const signature = await solver._signTypedData(
      {
        chainId,
        verifyingContract: solverTrampoline.address,
      },
      {
        Settlement: [
          { name: "settlement", type: "bytes" },
          { name: "nonce", type: "uint256" },
        ],
      },
      {
        settlement: emptySettlement,
        nonce,
      },
    );

    const { r, s, v } = await ethers.utils.splitSignature(signature);
    return await solverTrampoline.settle(emptySettlement, nonce, r, s, v);
  }

  // Ensure that the solver already has executed a trampolined settlement in
  // order for its nonce to be non-zero.
  const firstSettlement = await trampolineEmptyTestSettlement();
  await firstSettlement.wait();

  const secondSettlement = await trampolineEmptyTestSettlement();
  const { gasUsed } = await secondSettlement.wait();
  console.log(`gas used: ${gasUsed}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
