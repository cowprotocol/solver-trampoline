// SPDX-License-Identifier: LGPL-3.0-or-later
pragma solidity ^0.8.17;

/// @title CoW Protocol Solver Authentication Interface
/// @author CoW Protocol Developers
/// @dev Simplified interface to the contract responsible for authenticating
/// solvers by public address.
interface Authentication {
    function isSolver(address) external view returns (bool);
}

/// @title CoW Protocol Settlement Interface
/// @author CoW Protocol Developers
/// @dev Simplified interface to the main CoW Protocol settlement contract.
interface Settlement {
    function authenticator() external view returns (Authentication);
}