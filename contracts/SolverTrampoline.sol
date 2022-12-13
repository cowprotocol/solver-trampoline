// SPDX-License-Identifier: LGPL-3.0-or-later
pragma solidity ^0.8.17;

import { Authentication, Settlement } from "./CoWProtocol.sol";

/// @title CoW Protocol Solver Trampoline
/// @author CoW Protocol Developers
/// @dev A solver trampoline contract that allows permissionless execution of
/// signed authorized settlements. This can be used to allow relayers to execute
/// settlements on behalf solvers without being a registered solver themselves.
contract SolverTrampoline {
    /// @dev Error indicating that the signer of a settlement is not an
    /// authorized solver.
    error Unauthorized();
    /// @dev Error that the specified nonce is not valid for the signer.
    error InvalidNonce();

    /// @dev The CoW Protocol settlement contract.
    Settlement public immutable settlementContract;
    /// @dev the CoW Protocol solver authenticator.
    Authentication public immutable solverAuthenticator;

    /// @dev The domain separator for signing EIP-712 settlements.
    bytes32 public immutable domainSeparator;

    /// @dev Nonce by solver address.
    mapping(address => uint256) public nonces;

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
            revert Unauthorized();
        }
        if (nonce != nonces[solver]) {
            revert InvalidNonce();
        }

        nonces[solver] = nonce + 1;
        (bool success, bytes memory data) = address(settlementContract).call(settlement);
        if (!success) {
            // Propagate the revert error.
            assembly {
                revert(add(data, 32), mload(data))
            }
        }
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
