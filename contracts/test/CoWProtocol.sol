// SPDX-License-Identifier: LGPL-3.0-or-later
pragma solidity ^0.8.17;

import { Authentication, Settlement } from "../CoWProtocol.sol";

contract TestAuthentication is Authentication {
    address public allowedSolver;

    constructor(address allowedSolver_) {
        allowedSolver = allowedSolver_;
    }

    function isSolver(address solver) external view returns (bool) {
        return solver == allowedSolver;
    }
}

contract TestSettlement is Settlement {
    Authentication public authenticator;

    constructor(address allowedSolver) {
        authenticator = new TestAuthentication(allowedSolver);
    }

    fallback() external {
        // Make a call to the authentication contract. This just gives us more
        // accurate benchmarks as it more accurately captures the "win" we get
        // by the authentication contract already being warm.
        authenticator.isSolver(address(0));
    }

    function doSomething(bool shouldRevert) external pure {
        require(!shouldRevert, "test settlement reverted");
    }
}
