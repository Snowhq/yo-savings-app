import React, { useState } from "react";
import { createWalletClient, custom, createPublicClient, http } from "viem";
import { base } from "viem/chains";
import {
  createYoClient,
  VAULTS,
  parseTokenAmount
} from "@yo-protocol/core";

function App() {
  const [wallet, setWallet] = useState(null);
  const [yo, setYo] = useState(null);
  const [walletClient, setWalletClient] = useState(null);
  const [vaults, setVaults] = useState([]);
  const [balances, setBalances] = useState({});
  const [positions, setPositions] = useState({});
  const [amounts, setAmounts] = useState({});
  const [vaultStates, setVaultStates] = useState({});

  // ✅ FIXED TOKEN LOGO HANDLER
  const getTokenLogo = (symbol) => {
    const clean = symbol.toUpperCase();

    if (clean.includes("USDC"))
      return "https://cryptologos.cc/logos/usd-coin-usdc-logo.png";

    if (clean.includes("ETH"))
      return "https://cryptologos.cc/logos/ethereum-eth-logo.png";

    if (clean.includes("BTC"))
      return "https://cryptologos.cc/logos/bitcoin-btc-logo.png";

    if (clean.includes("USDT"))
      return "https://cryptologos.cc/logos/tether-usdt-logo.png";

    if (clean.includes("EUR"))
      return "https://cryptologos.cc/logos/euro-eur-logo.png";

    if (clean.includes("XAU"))
      return "https://cryptologos.cc/logos/tether-gold-xaut-logo.png";

    return "https://via.placeholder.com/40";
  };

  // SAFE CALL
  const safeCall = async (fn) => {
    try {
      return await fn();
    } catch {
      return null;
    }
  };

  // LOAD ALL DATA
  const loadAll = async (yoClient, account, vaultList) => {
    const newBalances = {};
    const newPositions = {};
    const newStates = {};

    for (let v of vaultList) {
      const token = v?.underlying?.address?.[8453];

      const bal = await safeCall(() =>
        yoClient.getTokenBalance(token, account)
      );

      if (bal) {
        newBalances[v.address] =
          Number(bal.balance) / (10 ** bal.decimals);
      }

      const pos = await safeCall(() =>
        yoClient.getUserPosition(v.address, account)
      );

      newPositions[v.address] = {
        assets: pos?.assets || 0n,
      };

      const state = await safeCall(() =>
        yoClient.getVaultState(v.address)
      );

      if (state) newStates[v.address] = state;
    }

    setBalances(newBalances);
    setPositions(newPositions);
    setVaultStates(newStates);
  };

  // CONNECT
  const connectWallet = async () => {
    if (!window.ethereum) return alert("Install MetaMask");

    await window.ethereum.request({ method: "eth_requestAccounts" });
    const account = (await window.ethereum.request({
      method: "eth_accounts"
    }))[0];

    const wc = createWalletClient({
      chain: base,
      transport: custom(window.ethereum),
    });

    const publicClient = createPublicClient({
      chain: base,
      transport: http("https://base.publicnode.com"),
    });

    const yoClient = createYoClient({
      chainId: 8453,
      publicClients: { 8453: publicClient },
    });

    const vaultList = Object.values(VAULTS).filter(
      (v) => v.underlying?.address?.[8453]
    );

    setWallet(account);
    setWalletClient(wc);
    setYo(yoClient);
    setVaults(vaultList);

    await loadAll(yoClient, account, vaultList);
  };

  const handleChange = (i, val) => {
    setAmounts({ ...amounts, [i]: val });
  };

  // DEPOSIT
  const deposit = async (vault, i) => {
    try {
      const amount = amounts[i];
      if (!amount) return alert("Enter amount");

      const txs = await yo.prepareDepositWithApproval({
        vault: vault.address,
        token: vault.underlying.address[8453],
        owner: wallet,
        recipient: wallet,
        amount: parseTokenAmount(amount, vault.underlying.decimals),
      });

      for (const tx of txs) {
        const hash = await walletClient.sendTransaction({
          account: wallet,
          to: tx.to,
          data: tx.data,
          value: tx.value || 0n,
        });
        await yo.waitForTransaction(hash);
      }

      alert("Deposit successful");
      await loadAll(yo, wallet, vaults);

    } catch {
      alert("Deposit failed");
    }
  };

  // WITHDRAW
  const withdraw = async (vault) => {
    try {
      const shares = await yo.getShareBalance(vault.address, wallet);
      if (!shares || shares === 0n) return alert("No funds");

      const txs = await yo.prepareRedeemWithApproval({
        vault: vault.address,
        shares,
        owner: wallet,
        recipient: wallet,
      });

      for (const tx of txs) {
        const hash = await walletClient.sendTransaction({
          account: wallet,
          to: tx.to,
          data: tx.data,
          value: tx.value || 0n,
        });
        await yo.waitForTransaction(hash);
      }

      alert("Withdraw successful");
      await loadAll(yo, wallet, vaults);

    } catch {
      alert("Withdraw failed");
    }
  };

  return (
    <div style={{
      background: "#0b0f0c",
      minHeight: "100vh",
      color: "#e5e7eb",
      fontFamily: "Arial"
    }}>

      {/* HEADER */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "20px 40px"
      }}>
        <h2>YO Savings</h2>

        {wallet ? (
          <button onClick={() => setWallet(null)}>Disconnect</button>
        ) : (
          <button onClick={connectWallet}>Connect Wallet</button>
        )}
      </div>

      {/* HERO */}
      {!wallet && (
        <div style={{ textAlign: "center", marginTop: "100px" }}>
          <h1>Put your assets to work</h1>
          <p style={{ color: "#9ca3af" }}>
            Deposit and earn yield automatically.
          </p>
          <button onClick={connectWallet}>Get Started</button>
        </div>
      )}

      {/* VAULTS */}
      {wallet && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "20px",
          padding: "30px"
        }}>
          {vaults.map((v, i) => {
            const symbol = v.underlying.symbol;
            const decimals = v.underlying.decimals;

            return (
              <div key={i} style={{
                background: "#111714",
                padding: "20px",
                borderRadius: "12px"
              }}>

                {/* ✅ LOGO + TITLE */}
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <img
                    src={getTokenLogo(symbol)}
                    alt={symbol}
                    style={{ width: "36px", height: "36px", borderRadius: "50%" }}
                  />
                  <div>
                    <h3 style={{ margin: 0 }}>{v.name}</h3>
                    <p style={{ margin: 0, color: "#9ca3af", fontSize: "13px" }}>
                      {symbol}
                    </p>
                  </div>
                </div>

                <p>Wallet: {balances[v.address] || 0}</p>

                <p>TVL: {
                  vaultStates[v.address]
                    ? (Number(vaultStates[v.address].totalAssets) / (10 ** decimals)).toFixed(2)
                    : "..."
                }</p>

                <p>Deposited: {
                  Number(positions[v.address]?.assets || 0n) / (10 ** decimals)
                }</p>

                <input
                  placeholder="Amount"
                  value={amounts[i] || ""}
                  onChange={(e) => handleChange(i, e.target.value)}
                />

                <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                  <button onClick={() => deposit(v, i)}>Deposit</button>
                  <button onClick={() => withdraw(v)}>Withdraw</button>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default App;