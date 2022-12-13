import { ethers } from "hardhat";

async function main() {
  const SolverTrampoline = await ethers.getContractFactory("SolverTrampoline");
  const solverTrampoline = await SolverTrampoline.deploy(ethers.constants.AddressZero);

  await solverTrampoline.deployed();

  console.log(`SolverTrampoline deployed to ${solverTrampoline.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
