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

    return result;
}

async function main() {
    const releases = await getAllReleases();

    const sorted = releases.reverse();

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

        result.push({
            Version: current.tag_name.slice(1),
            ReleaseDate: current.published_at.split("T")[0],
            ChangeLogs: changeLogs
        });
    }

    result.reverse();

    const output = {
        Releases: result
    };

    fs.writeFileSync(
        "releases.json",
        JSON.stringify(output, null, 4),
        "utf-8"
    );

    console.log("完了: releases.json を生成しました");
}

main().catch(console.error);
