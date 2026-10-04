var crypto = require("crypto");
const {parentPort } = require('worker_threads');
const now = require('nano-time');

/**
 * Searches for a nonce whose header hash beats `target`.
 *
 * The header is `index ‖ parentHash ‖ bodyHash ‖ target ‖ timestamp ‖ nonce`, and only
 * the last 16 bytes change from one attempt to the next. The fixed prefix is therefore
 * built once and every attempt hashes one reusable buffer, writing the nonce in place
 * instead of allocating a fresh concat each pass.
 *
 * That matters because this loop runs tens of millions of times per block at the default
 * target. The previous version allocated a new Buffer.concat plus two BigInts per
 * iteration and called into nano-time on every pass; the garbage outpaced collection and
 * the node aborted with a 4 GB heap after a handful of blocks.
 *
 * The timestamp is written once when the search starts. It is still a real clock reading,
 * so a block records roughly when it was mined, but re-reading it per attempt only burned
 * allocations without changing the security: the nonce alone supplies the varying input
 * the proof of work needs, and the node never validates the timestamp (it only logs it).
 */
function miner(buf, target) {
    const PREFIX_LEN = buf.length;
    const bufCheck = Buffer.alloc(PREFIX_LEN + 16);
    buf.copy(bufCheck, 0, 0, PREFIX_LEN);
    bufCheck.writeBigUInt64BE(BigInt(now()), PREFIX_LEN);

    let nonce = 0n;

    while (true) {
        bufCheck.writeBigUInt64BE(nonce, PREFIX_LEN + 8);

        const checkString = crypto.createHash('sha256').update(bufCheck).digest('hex');
        if (checkString < target) {
            parentPort.postMessage({ header: Buffer.from(bufCheck) });
            return;
        }
        nonce += 1n;
    }
}

parentPort.on('message', message => {

    let header = message.header;
    var bufIndex = Buffer.alloc(4);
    bufIndex.writeInt32BE(header.index, 0);
    var bufHashParent = Buffer.from(header.hashParent,'hex');
    var bufHashBlockbody = Buffer.from(header.hashBlockbody,'hex');
    var bufTarget = Buffer.from(header.target , 'hex');
    var buf = Buffer.concat([bufIndex,bufHashParent,bufHashBlockbody,bufTarget]);
    miner(buf, header.target);

});