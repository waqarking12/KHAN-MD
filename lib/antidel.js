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

const DeletedMedia = async (conn, mek, jid, deleteInfo, isImageOrVideo) => {
    const antideletedmek = structuredClone(mek.message);
    const messageType = Object.keys(antideletedmek)[0];
    
    if (isImageOrVideo) {
        // For images and videos, put delete info in caption
        if (antideletedmek[messageType]) {
            antideletedmek[messageType].contextInfo = {
                stanzaId: mek.key.id,
                participant: mek.sender,
                quotedMessage: mek.message,
            };
            antideletedmek[messageType].caption = deleteInfo;
        }
        await conn.relayMessage(jid, antideletedmek, {});
    } else {
        // For other media types (audio, documents), send as quoted text
        await conn.sendMessage(jid, { text: deleteInfo }, { quoted: mek });
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

                // Get current time in 24-hour format with seconds
                const now = new Date();
                const deleteTime = now.toLocaleTimeString('en-US', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });

                let deleteInfo, jid;
                const baseInfo = `*╭────⬡ KHAN-MD ❤‍🔥 ⬡────*\n` +
                                `*├♻️ SENDER:* @${mek.key.participant?.split('@')[0] || mek.key.remoteJid?.split('@')[0]}\n` +
                                (isGroup ? `*├👥 GROUP:* ${(await conn.groupMetadata(store.jid)).subject}\n` : '') +
                                `*├⏰ DELETE TIME:* ${deleteTime}\n` +
                                `*├🗑️ DELETED BY:* @${update.key.participant?.split('@')[0] || update.key.remoteJid?.split('@')[0]}\n` +
                                `*├⚠️ ACTION:* Deleted a Message`;

                if (isGroup) {
                    jid = config.ANTI_DEL_PATH === "inbox" ? conn.user.id : store.jid;
                } else {
                    jid = config.ANTI_DEL_PATH === "inbox" ? conn.user.id : update.key.remoteJid;
                }

                const messageType = mek.message ? Object.keys(mek.message)[0] : null;
                const isImageOrVideo = messageType === 'imageMessage' || messageType === 'videoMessage';

                if (isImageOrVideo) {
                    // Simplified format for images/videos
                    deleteInfo = `${baseInfo}\n*╰────⬡ KHAN-MD ⬡────*`;
                } else {
                    // Full format with content indicator for other messages
                    deleteInfo = `${baseInfo}\n*╰💬 MESSAGE:* Content Below 🔽`;
                }

                if (mek.message?.conversation || mek.message?.extendedTextMessage) {
                    await DeletedText(conn, mek, jid, deleteInfo, isGroup, update);
                } else {
                    await DeletedMedia(conn, mek, jid, deleteInfo, isImageOrVideo);
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
