// SPDX-License-Identifier: LGPL-3.0-or-later
pragma solidity ^0.8.17;

import { Authentication, Settlement } from "./CoWProtocol.sol";

/// @title CoW Protocol Solver Trampoline
/// @author CoW Protocol Developers
/// @dev A solver trampoline contract that allows permissionless execution of
/// signed authorized settlements. This can be used to allow relayers to execute
/// settlements on behalf solvers without being a registered solver themselves.
contract SolverTrampoline {
    /// @dev The domain separator for signing EIP-712 settlements.
    bytes32 public immutable domainSeparator;

    constructor() {
        domainSeparator = keccak256(abi.encode(
            keccak256("EIP712Domain(uint256 chainId,address verifyingContract)"),
            block.chainid,
            address(this)
        ));
    }

    /// @dev Returns the EIP-712 signing digest for the specified settlement
    /// hash and nonce.
    function settlementMessage(bytes calldata settlement, uint256 nonce) public view returns (bytes32) {
        return keccak256(abi.encodePacked(
            hex"1901",
            domainSeparator,
            keccak256(abi.encode(
                keccak256("Settlement(bytes settlement,uint256 nonce)"),
                keccak256(settlement),
                nonce
            ))
        ));
    }
}
