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
    const deadline = ethers.constants.MaxUint256;
    const signature = await solver._signTypedData(
      {
        chainId,
        verifyingContract: solverTrampoline.address,
      },
      {
        Settlement: [
          { name: "settlement", type: "bytes" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      {
        settlement: emptySettlement,
        nonce,
        deadline,
      },
    );

    const { v, r, s } = await ethers.utils.splitSignature(signature);
    return await solverTrampoline.settle(emptySettlement, nonce, deadline, v, r, s);
  }

  // Ensure that the solver already has executed a trampolined settlement in
  // order for its nonce to be non-zero.
  const cancelFirstNonce = await solverTrampoline.cancelCurrentNonce();
  await cancelFirstNonce.wait();

  const trampolinedSettlement = await trampolineEmptyTestSettlement();
  const { gasUsed: trampolineGasUsed } = await trampolinedSettlement.wait();

  const directSettlement = await settlementContract.fallback();
  const { gasUsed: directGasUsed } = await directSettlement.wait();
  console.log(`gas used: ${trampolineGasUsed.sub(directGasUsed)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
