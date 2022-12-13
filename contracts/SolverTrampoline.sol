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
    error Unauthorized(address solver);
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
        bytes32 messageDigest = settlementMessage(settlement, nonce);
        address solver = ecrecover(messageDigest, v, r, s);
        if (solver == address(0) || !solverAuthenticator.isSolver(solver)) {
            revert Unauthorized(solver);
        }

        if (nonce != nonces[solver]) {
            revert InvalidNonce();
        }
        nonces[solver] = nonce + 1;

        // Use a low-level `call` instead of calling `settle` directly. This is
        // for a couple reasons:
        // - This allows us to support both `settle` and `swap` (fast-path)
        //   without any additional logic.
        // - No additional `settle` paramter and decoding code needs to be
        //   generated by the compiler, which would be quite gas innefficient.
        // - Generally speaking, it is nice that trampoline doesn't care about
        //   what it is calling (just who signed it).
        (bool success, bytes memory data) = address(settlementContract).call(settlement);
        if (!success) {
            // Propagate the revert error.
            assembly {
                revert(add(data, 32), mload(data))
            }
        }

        emit TrampolinedSettlement(solver, nonce);
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
