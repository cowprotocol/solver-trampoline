// SPDX-License-Identifier: LGPL-3.0-or-later
pragma solidity ^0.8.17;

import { Authentication, Settlement } from "./CoWProtocol.sol";

/// @title CoW Protocol Solver Trampoline
/// @author CoW Protocol Developers
/// @dev A solver trampoline contract that allows permissionless execution of
/// signed authorized settlements. This can be used to allow relayers to execute
/// settlements on behalf solvers without being a registered solver themselves.
contract SolverTrampoline {
    /// @dev The CoW Protocol settlement contract.
    Settlement public immutable settlementContract;
    /// @dev the CoW Protocol solver authenticator.
    Authentication public immutable solverAuthenticator;

    /// @dev The domain separator for signing EIP-712 settlements.
    bytes32 public immutable domainSeparator;

    /// @dev Nonce by solver address.
    mapping(address => uint256) public nonces;

    /// @dev An event that is emitted on a trampolined settlement.
    event TrampolinedSettlement(address indexed solver, uint256 nonce);

    /// @dev Error indicating that the signer of a settlement is not an
    /// authorized solver.
    error Unauthorized();
    /// @dev Error that the specified nonce is not valid for the signer.
    error InvalidNonce();

    constructor(Settlement settlementContract_) {
        settlementContract = settlementContract_;
        solverAuthenticator = settlementContract_.authenticator();

        domainSeparator = keccak256(abi.encode(
            keccak256("EIP712Domain(uint256 chainId,address verifyingContract)"),
            block.chainid,
            address(this)
        ));
    }

    /// @dev Executes a settlement on behalf of a solver.
    function settle(bytes calldata settlement, uint256 nonce, bytes32 r, bytes32 s, uint8 v) external {
        address settlementAddress = address(settlementContract);
        bytes32 settlementDigest;
        assembly {
            // Load the "free memory pointer" as the starting offset, in memory,
            // to copy the settlement calldata to.
            // See <https://docs.soliditylang.org/en/v0.8.17/internals/layout_in_memory.html>.
            let settlementBuffer := mload(0x40)
            calldatacopy(settlementBuffer, settlement.offset, settlement.length)

            // Compute the settlement digest, we use this later when verifying
            // the signer of the settlement calldata.
            settlementDigest := keccak256(settlementBuffer, settlement.length)

            // Optimistically call the settlement contract. We use assembly for
            // this for two reasons:
            // 1. It avoids a `EXTCODESIZE` instruction, since the settlement
            //    contract existing is a valid assumption here (we already
            //    called it in the constructor)
            // 2. It avoids inefficient code generation around copying memory
            //    for low-level `.call()`s.
            if iszero(call(
                gas(),
                settlementAddress,
                0, // value
                settlementBuffer,
                settlement.length,
                0, // outOffset
                0  // outSize
            )) {
                // Propagate the revert error.
                returndatacopy(0, 0, returndatasize())
                revert(0, returndatasize())
            }
        }

        bytes32 messageDigest = settlementMessage(settlementDigest, nonce);
        address solver = ecrecover(messageDigest, v, r, s);

        if (solver == address(0) || !solverAuthenticator.isSolver(solver)) {
            revert Unauthorized();
        }
        if (nonce != nonces[solver]) {
            revert InvalidNonce();
        }

        nonces[solver] = nonce + 1;

        emit TrampolinedSettlement(solver, nonce);
    }

    /// @dev Returns the EIP-712 signing digest for the specified settlement
    /// hash and nonce.
    function settlementMessage(bytes calldata settlement, uint256 nonce) external view returns (bytes32) {
        return settlementMessage(keccak256(settlement), nonce);
    }

    /// @dev Returns the EIP-712 signing digest for the specified settlement
    /// hash and nonce.
    function settlementMessage(bytes32 settlementDigest, uint256 nonce) private view returns (bytes32) {
        return keccak256(abi.encodePacked(
            hex"1901",
            domainSeparator,
            keccak256(abi.encode(
                keccak256("Settlement(bytes settlement,uint256 nonce)"),
                settlementDigest,
                nonce
            ))
        ));
    }
}
