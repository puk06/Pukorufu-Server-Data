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

async function getCommits(prevTag, currentTag) {
    const res = await api.get(`/repos/${OWNER}/${REPO}/compare/${prevTag}...${currentTag}`);
    return res.data.commits;
}

function classify(commits) {
    const result = {
        Added: [],
        Fixed: [],
        Changed: []
    };

    for (const c of commits) {
        let msg = c.commit.message.split("\n")[0];
        const normalized = msg.toLowerCase();
        
        msg = msg.replace(/^\w+(\(.+\))?:\s*/, "");

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

async function main() {
    const releases = await getAllReleases();

    const sorted = releases.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    const result = [];

    for (let i = 0; i < sorted.length; i++) {
        const current = sorted[i];
        const prev = sorted[i - 1];

        let changeLogs = {
            Added: [],
            Fixed: [],
            Changed: []
        };

        if (prev) {
            const commits = await getCommits(prev.tag_name, current.tag_name);
            changeLogs = classify(commits);
        }

        const date = new Date(current.published_at);
        const jstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000));
        const releaseDateStr = jstDate.toISOString().split("T")[0];

        result.push({
            Version: current.tag_name.startsWith("v")
                ? current.tag_name.slice(1).replace(/-stable$/, "")
                : current.tag_name.replace(/-stable$/, ""),
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
