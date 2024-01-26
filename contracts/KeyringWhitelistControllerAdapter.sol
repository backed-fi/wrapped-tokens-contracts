pragma solidity ^0.8.9;

import "./interfaces/WhitelistControllerInterface.sol";

interface IKeyringCredentials {
    function subjectUpdates(bytes32 subject) external view returns (uint256 timestamp);
    function keyGen(address trader, uint32 admissionPolicyId) external pure returns (bytes32 key);
}

interface IPolicyManager {
    function policyTtl(uint32 admissionPolicyId) external returns (uint32 ttl);
}

/**
 * @dev
 *
 * Keyring Whitelist adapter contract
 *
 */
contract KeyringWhitelistControllerAdapter is WhitelistControllerInterface {
    
    address public immutable parentAggregator;
    address public immutable keyringCredentials;
    address public immutable policyManager;
    uint32 public immutable admissionPolicyId;

    event KeyringCredentialCheck(address indexed sender, address indexed subject, bool whitelisted);

    constructor(address _parentAggregator,address _keyringCredentials, address _policyManager, uint32 _admissionPolicyId) {
        parentAggregator = _parentAggregator;
        keyringCredentials = _keyringCredentials;
        policyManager = _policyManager;
        admissionPolicyId = _admissionPolicyId;
    }

    /**
     * @dev Checks if given address is whitelisted on Keyring registry. Callable only by whitelist aggregator
     * 
     * @param addr                Address to be checked
     * 
     * @return whitelistStatus    Flag whether given address is whitelisted
     */
    function isWhitelisted(address addr) external returns (bool whitelistStatus) {
        require(msg.sender == parentAggregator, "Not authorized");

        // Lookup key for admission-policy-rule's last time of update
        bytes32 key = IKeyringCredentials(keyringCredentials).keyGen(addr, admissionPolicyId);

        // Timestamp of Check + Time-to-Live >= Now(ish)
        whitelistStatus = (
            IKeyringCredentials(keyringCredentials).subjectUpdates(key) +
                IPolicyManager(policyManager).policyTtl(admissionPolicyId)
            >= block.timestamp
        );
        emit KeyringCredentialCheck(address(this), addr, whitelistStatus);
    }
}
