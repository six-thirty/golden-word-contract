pragma solidity ^0.4.17;

library Base {
    struct NTVUConfig {
        uint bidStartValue;
        int bidStartTime;
        int bidEndTime;

        uint tvUseStartTime;
        uint tvUseEndTime;

        bool isPrivate;
        bool special;
    }
}