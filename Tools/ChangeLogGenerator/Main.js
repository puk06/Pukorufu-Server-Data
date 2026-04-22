const axios = require("axios");
require("dotenv").config();
const fs = require("node:fs");

const OWNER = "puk06";
const REPO = "VRC-Avatar-Explorer";
const TOKEN = process.env.GITHUB_TOKEN;

const api = axios.create({
    baseURL: "https://api.github.com",
    headers: {
        Authorization: `Bearer ${TOKEN}`,
        "User-Agent": "release-aggregator"
    }
});

async function getAllReleases() {
    const res = await api.get(`/repos/${OWNER}/${REPO}/releases`);
    return res.data;
}

function classify(lines) {
    const result = {
        Added: [],
        Fixed: [],
        Changed: []
    };

    function capitalizeFirst(text) {
        if (!text) {
            return text;
        }

        return text.charAt(0).toUpperCase() + text.slice(1);
    }

    for (let msg of lines) {
        const normalized = msg.toLowerCase();
        
        msg = msg.replace(/^\w+(\(.+\))?:\s*/, "");
        msg = capitalizeFirst(msg);

        if (normalized.startsWith("feat")) {
            result.Added.push(msg);
        } else if (normalized.startsWith("fix")) {
            result.Fixed.push(msg);
        } else {
            result.Changed.push(msg);
        }
    }
    
    for (const key in result) {
        result[key] = [...new Set(result[key])];
    }

    return result;
}

function extractWhatsChangedLines(body) {
    if (!body) {
        return [];
    }

    const lines = body.split(/\r?\n/);
    const startIndex = lines.findIndex(line => /^#{1,6}\s*what'?s changed\s*$/i.test(line.trim()));

    if (startIndex === -1) {
        return [];
    }

    const extracted = [];

    for (let i = startIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();

        if (/^#{1,6}\s+/.test(line)) {
            break;
        }

        if (!line || !/^[-*]\s+/.test(line)) {
            continue;
        }

        let item = line.replace(/^[-*]\s+/, "");
        item = item.replace(/(\s+by\s+@\S+).*/i, "$1");
        extracted.push(item.trim());
    }

    return extracted;
}

function normalizeVersion(tagName) {
    return tagName.startsWith("v")
        ? tagName.slice(1).replace(/-stable$/, "")
        : tagName.replace(/-stable$/, "");
}

async function main() {
    const releases = await getAllReleases();

    const sorted = releases.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    const result = [];

    for (const element of sorted) {
        const current = element;
        const whatsChangedLines = extractWhatsChangedLines(current.body);
        const changeLogs = classify(whatsChangedLines);

        const date = new Date(current.published_at);
        const jstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000));
        const releaseDateStr = jstDate.toISOString().split("T")[0];

        result.push({
            Version: normalizeVersion(current.tag_name),
            ReleaseDate: releaseDateStr,
            ChangeLogs: changeLogs,
            ReleaseUrl: "https://github.com/puk06/VRC-Avatar-Explorer/releases/tag/" + current.tag_name
        });
    }

    result.reverse();

    const output = {
        Releases: result
    };

    fs.writeFileSync(
        "../../Update-Check-Server/avatarexplorerv2.json",
        JSON.stringify(output, null, 4),
        "utf-8"
    );

    console.log("完了: 生成しました");
}

main().catch(console.error);
