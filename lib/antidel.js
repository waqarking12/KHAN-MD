const { isJidGroup } = require('@whiskeysockets/baileys');
const { loadMessage, getAnti } = require('../data');
const config = require('../config');

const DeletedText = async (conn, mek, jid, deleteInfo, isGroup, update) => {
    const messageContent = mek.message?.conversation || mek.message?.extendedTextMessage?.text || 'Unknown content';
    deleteInfo += `\n◈ Content ━ ${messageContent}`;

    await conn.sendMessage(
        jid,
        {
            text: deleteInfo,
            contextInfo: {
                mentionedJid: isGroup ? [update.key.participant, mek.key.participant] : [update.key.remoteJid],
            },
        },
        { quoted: mek },
    );
};

const DeletedMedia = async (conn, mek, jid, deleteInfo, messageType) => {
    const antideletedmek = structuredClone(mek.message);
    
    if (antideletedmek[messageType]) {
        antideletedmek[messageType].contextInfo = {
            stanzaId: mek.key.id,
            participant: mek.sender,
            quotedMessage: mek.message,
        };
    }
    
    if (messageType === 'imageMessage' || messageType === 'videoMessage') {
        // Separate handling for image and video with delete info as caption
        const mediaType = messageType === 'imageMessage' ? 'Image' : 'Video';
        const caption = `*⚠️ Deleted ${mediaType} Alert 🚨*\n${deleteInfo}`;
        antideletedmek[messageType].caption = caption;
        await conn.relayMessage(jid, antideletedmek, {});
    } else if (messageType === 'audioMessage' || messageType === 'documentMessage') {
        // For audio and documents, send delete info as separate message
        await conn.sendMessage(jid, { text: `*⚠️ Deleted Message Alert 🚨*\n${deleteInfo}` }, { quoted: mek });
        await conn.relayMessage(jid, antideletedmek, {});
    }
};

const AntiDelete = async (conn, updates) => {
    for (const update of updates) {
        if (update.update.message === null) {
            const store = await loadMessage(update.key.id);

            if (store && store.message) {
                const mek = store.message;
                const isGroup = isJidGroup(store.jid);
                const antiDeleteStatus = await getAnti();
                if (!antiDeleteStatus) continue;

                // Get current time in local timezone with proper formatting
                const now = new Date();
                const deleteTime = now.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true // 24-hour format
                });

                let deleteInfo, jid;
                if (isGroup) {
                    const groupMetadata = await conn.groupMetadata(store.jid);
                    const groupName = groupMetadata.subject;
                    const sender = mek.key.participant?.split('@')[0];
                    const deleter = update.key.participant?.split('@')[0];

                    deleteInfo = `*╭────⬡ KHAN-MD ❤‍🔥 ⬡────*
*├♻️ SENDER:* @${sender}
*├👥 GROUP:* ${groupName}
*├⏰ DELETE TIME:* ${deleteTime}
*├🗑️ DELETED BY:* @${deleter}
*├⚠️ ACTION:* Deleted a Message 
*╰💬 MESSAGE:* Content Below 🔽`;
                    jid = config.ANTI_DEL_PATH === "inbox" ? conn.user.id : store.jid;
                } else {
                    const senderNumber = mek.key.remoteJid?.split('@')[0];
                    const deleterNumber = update.key.remoteJid?.split('@')[0];
                    
                    deleteInfo = `*╭────⬡ 🤖 KHAN-MD ⬡────*
*├👤 SENDER:* @${senderNumber}
*├⏰ DELETE TIME:* ${deleteTime}
*├⚠️ ACTION:* Deleted a Message 
*╰💬 MESSAGE:* Content Below 🔽`;
                    jid = config.ANTI_DEL_PATH === "inbox" ? conn.user.id : update.key.remoteJid;
                }

                if (mek.message?.conversation || mek.message?.extendedTextMessage) {
                    await DeletedText(conn, mek, jid, deleteInfo, isGroup, update);
                } else {
                    const messageType = Object.keys(mek.message)[0];
                    await DeletedMedia(conn, mek, jid, deleteInfo, messageType);
                }
            }
        }
    }
};

module.exports = {
    DeletedText,
    DeletedMedia,
    AntiDelete,
};
