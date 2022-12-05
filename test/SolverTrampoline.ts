import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("SolverTrampoline", function () {
  async function fixture() {
    const SolverTrampoline = await ethers.getContractFactory("SolverTrampoline");
    const solverTrampoline = await SolverTrampoline.deploy();

    return { solverTrampoline };
  }

  describe("Deployment", function () {
    it("Should have an address", async function () {
      const { solverTrampoline } = await loadFixture(fixture);

      expect(solverTrampoline.address).to.not.equal(ethers.constants.AddressZero);
    });
  });
});
