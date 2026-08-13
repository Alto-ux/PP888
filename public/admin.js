const $ = (s) => document.querySelector(s);

async function api(url, options = {}) {
    const response = await fetch(url, {
        credentials: "same-origin",
        cache: "no-store",
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    let data = {};

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
}


// ==============================
// CHECK ADMIN SESSION
// ==============================

async function check() {
    try {
        const data = await api("/api/admin/me");

        console.log("ADMIN SESSION:", data);

        $("#login").classList.add("hidden");
        $("#shell").classList.remove("hidden");

        await page("dashboard");

    } catch (error) {

        console.log("ADMIN CHECK FAILED:", error);

        $("#login").classList.remove("hidden");
        $("#shell").classList.add("hidden");

        const msg = $("#msg");

        if (msg) {
            msg.textContent = error.message || "Please login";
        }
    }
}


// ==============================
// LOGIN
// ==============================

$("#form").addEventListener("submit", async (event) => {

    event.preventDefault();

    const msg = $("#msg");

    if (msg) {
        msg.textContent = "Logging in...";
    }

    try {

        const formData = new FormData(event.target);

        const username = String(
            formData.get("username") || ""
        ).trim();

        const password = String(
            formData.get("password") || ""
        );

        if (!username || !password) {
            throw new Error("กรุณากรอก Username และ Password");
        }

        const result = await api("/api/login", {
            method: "POST",
            body: JSON.stringify({
                username,
                password
            })
        });

        console.log("LOGIN RESULT:", result);

        if (!result.user) {
            throw new Error("Login response ไม่ถูกต้อง");
        }

        if (result.user.role !== "admin") {
            throw new Error("บัญชีนี้ไม่มีสิทธิ์ Admin");
        }

        if (msg) {
            msg.textContent = "Login successful";
        }

        // ตรวจ session อีกครั้ง
        await check();

    } catch (error) {

        console.error("LOGIN ERROR:", error);

        if (msg) {
            msg.textContent =
                error.message || "Login failed";
        }
    }
});


// ==============================
// LOGOUT
// ==============================

async function logout() {

    try {
        await api("/api/logout", {
            method: "POST"
        });

    } catch (error) {

        console.error(error);

    } finally {

        location.href = "/admin.html";
    }
}


// ==============================
// PAGE
// ==============================

async function page(name) {

    const content = $("#content");

    if (!content) {
        console.error("Missing #content");
        return;
    }

    try {

        // ==========================
        // DASHBOARD
        // ==========================

        if (name === "dashboard") {

            const data =
                await api("/api/admin/dashboard");

            const stats = data.stats || {};

            content.innerHTML = `
                <h1>Dashboard</h1>

                <div class="cards">

                    ${Object.entries(stats)
                        .map(([key, value]) => `
                            <div class="card">

                                <b>
                                    ${Number(value || 0).toLocaleString()}
                                </b>

                                <small>
                                    ${key.toUpperCase()}
                                </small>

                            </div>
                        `)
                        .join("")}

                </div>
            `;

            return;
        }


        // ==========================
        // PLAYERS
        // ==========================

        if (name === "players") {

            const data =
                await api("/api/admin/players");

            const players = data.players || [];

            content.innerHTML = `

                <h1>Players & Credit</h1>

                <div class="panel">

                    <table>

                        <tr>
                            <th>PLAYER</th>
                            <th>CREDIT</th>
                            <th>ACTIONS</th>
                        </tr>

                        ${
                            players.length
                            ?
                            players.map(player => `

                                <tr>

                                    <td>

                                        ${escapeHtml(
                                            player.display_name
                                        )}

                                        <br>

                                        <small>
                                            ${escapeHtml(
                                                player.username
                                            )}
                                        </small>

                                    </td>

                                    <td>
                                        ${Number(
                                            player.credit || 0
                                        ).toFixed(2)}
                                    </td>

                                    <td>

                                        <div class="row">

                                            <button
                                                onclick="adj(${player.id}, 'add')"
                                            >
                                                + CREDIT
                                            </button>

                                            <button
                                                onclick="adj(${player.id}, 'remove')"
                                            >
                                                − CREDIT
                                            </button>

                                            <button
                                                onclick="adj(${player.id}, 'set')"
                                            >
                                                SET CREDIT
                                            </button>

                                        </div>

                                    </td>

                                </tr>

                            `).join("")
                            :
                            `
                                <tr>
                                    <td colspan="3">
                                        No players
                                    </td>
                                </tr>
                            `
                        }

                    </table>

                </div>
            `;

            return;
        }


        // ==========================
        // GAMES
        // ==========================

        if (name === "games") {

            const data =
                await api("/api/admin/config");

            const configs = data.config || [];

            const keys = [
                "min_reward",
                "max_reward",
                "big_reward",
                "mega_reward",
                "epic_reward",
                "big_event_percent",
                "mega_event_percent",
                "epic_event_percent",
                "max_round_cost",
                "min_bet",
                "bet_step"
            ];

            content.innerHTML = `

                <h1>Game Balance</h1>

                <div class="panel">
                    <small>
                        Fictional arcade event-frequency settings.
                    </small>
                </div>

                ${
                    configs.map(game => `

                        <div class="form">

                            <h2>
                                ${escapeHtml(game.game_id)}
                            </h2>

                            ${
                                keys.map(key => `

                                    <label>

                                        ${key
                                            .replaceAll("_", " ")
                                            .toUpperCase()
                                        }

                                        <input
                                            type="number"
                                            step="0.01"
                                            id="${game.game_id}_${key}"
                                            value="${Number(
                                                game[key] ?? 0
                                            )}"
                                        >

                                    </label>

                                `).join("")
                            }

                            <button
                                onclick="save('${game.game_id}')"
                            >
                                SAVE
                            </button>

                        </div>

                    `).join("")
                }
            `;

            return;
        }


        // ==========================
        // LOGS
        // ==========================

        if (name === "logs") {

            const data =
                await api("/api/admin/logs");

            const logs = data.logs || [];

            content.innerHTML = `

                <h1>Audit Logs</h1>

                <div class="panel">

                    <table>

                        <tr>
                            <th>TIME</th>
                            <th>ACTION</th>
                            <th>TARGET</th>
                            <th>OLD</th>
                            <th>NEW</th>
                        </tr>

                        ${
                            logs.map(log => `

                                <tr>

                                    <td>
                                        ${escapeHtml(
                                            log.created_at || ""
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            log.action || ""
                                        )}
                                    </td>

                                    <td>
                                        ${log.target_user_id || "-"}
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            log.old_value || ""
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            log.new_value || ""
                                        )}
                                    </td>

                                </tr>

                            `).join("")
                        }

                    </table>

                </div>
            `;

            return;
        }

    } catch (error) {

        console.error("PAGE ERROR:", error);

        content.innerHTML = `

            <div class="panel">

                <b>Admin API Error</b>

                <p>
                    ${escapeHtml(error.message)}
                </p>

                <button onclick="page('${name}')">
                    Retry
                </button>

            </div>
        `;
    }
}


// ==============================
// CREDIT
// ==============================

async function adj(id, mode) {

    const amount = Number(
        prompt(
            mode === "set"
                ? "Set CREDIT to:"
                : "Amount:"
        )
    );

    if (!Number.isFinite(amount) || amount < 0) {
        return;
    }

    try {

        await api(
            `/api/admin/players/${id}/credit`,
            {
                method: "POST",

                body: JSON.stringify({
                    mode,
                    amount
                })
            }
        );

        await page("players");

    } catch (error) {

        alert(error.message);
    }
}


// ==============================
// GAME SAVE
// ==============================

async function save(id) {

    const keys = [
        "min_reward",
        "max_reward",
        "big_reward",
        "mega_reward",
        "epic_reward",
        "big_event_percent",
        "mega_event_percent",
        "epic_event_percent",
        "max_round_cost",
        "min_bet",
        "bet_step"
    ];

    const values = {};

    for (const key of keys) {

        const element =
            document.getElementById(
                `${id}_${key}`
            );

        if (!element) {
            alert(`Missing field: ${key}`);
            return;
        }

        values[key] = Number(element.value);

        if (!Number.isFinite(values[key])) {
            alert(`${key} is invalid`);
            return;
        }
    }

    try {

        await api(
            `/api/admin/config/${id}`,
            {
                method: "PUT",

                body: JSON.stringify(values)
            }
        );

        alert("Saved");

    } catch (error) {

        alert(error.message);
    }
}


// ==============================
// ESCAPE HTML
// ==============================

function escapeHtml(value) {

    return String(value)

        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// ==============================
// START
// ==============================

check();