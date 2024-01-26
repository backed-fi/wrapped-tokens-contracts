/**
 * SPDX-License-Identifier: MIT
 *
 * Copyright (c) 2021-2023 Backed Finance AG
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./WhitelistController.sol";

/**
 * @dev
 *
 * WhitelistControllerAggregator contract, which is responsible for checking user being whitelisted
 * by any of the registered whitelist controllers.
 * 
 * Due to lack of standardized approach for creating such whitelist registries, each external one
 * should be added via additional adapter contract, which will translate our interface to external one.
 *
 */
contract WhitelistControllerAggregator is OwnableUpgradeable {
    address[] public controllers;
    mapping(address => bool) public isAuthorizedCaller;
    mapping(address => bool) public isCallerAdmin;

    event AddedController(address indexed controller);
    event RemovedController(address indexed controller);
    event UpdatedCaller(address indexed caller, bool indexed newState);
    event UpdatedCallerAdmin(address indexed callerAdmin, bool indexed newState);

    constructor() {
        _disableInitializers();
    }
    
    function initialize() external initializer {
        __Ownable_init();
    }

    modifier onlyAdmin() {
        require(isCallerAdmin[msg.sender], "Caller is not an admin");
        _;
    }

    /**
     * @dev Adds a new controller to registry. Callable only by the controller owner
     *
     * Emits a { AddedController } event
     * 
     * @param controller    Address of whitelist controller to add
     */
    function add(address controller) external onlyOwner {
        controllers.push(controller);
        emit AddedController(controller);
    }

    /**
     * @dev Removes a controller from registry. Callable only by the controller owner.
     * If needed, it first swaps controller at last index and requested one, before removing data at last index.
     *
     * Emits a { RemovedController } event
     * 
     * @param index    Index of the controller to be removed
     */
    function remove(uint256 index) external onlyOwner {
        address removedController = controllers[index];
        if (index != controllers.length - 1)
            controllers[index] = controllers[controllers.length - 1];
        controllers.pop();
        emit RemovedController(removedController);
    }

    /**
     * @dev Change admin state of given address. Callable only by the controller admin
     * 
     * @param caller    Address of caller to add or remove
     * @param value    Whether adding or removing an admin
     */
    function setCaller(address caller, bool value) external onlyAdmin {
        isAuthorizedCaller[caller] = value;
        
        emit UpdatedCaller(caller, value);
    }

    /**
     * @dev Change admin state of given address. Callable only by the controller owner
     * 
     * @param toSet    Address of admin to add or remove
     * @param value    Whether adding or removing an admin
     */
    function setCallerAdmin(address toSet, bool value) external onlyOwner {
        isCallerAdmin[toSet] = value;
        
        emit UpdatedCallerAdmin(toSet, value);
    }

    /**
     * @dev Checks in all registered controllers, whether given address is marked as whitelisted. Callable only by authorized caller (wrapped tokens)
     * 
     * @param addressToCheck          Address to be checked
     * 
     * @return isWhitelisted          A boolean indicating whether given address is whitelisted
     * @return whitelistController    Address of controller that whitelisted given address
     */
    function isWhitelisted(address addressToCheck) external returns (bool isWhitelisted, address whitelistController) {
        require(isAuthorizedCaller[msg.sender], "Not authorized");

        for (uint i = 0; i < controllers.length; i++) {
            if (WhitelistControllerInterface(controllers[i]).isWhitelisted(addressToCheck)) {
                return (true, controllers[i]);
            }
        }
        return (false, address(0));
    }
}