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

  // SAFE CALL
  const safeCall = async (fn, retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch {
        if (i === retries - 1) return null;
        await new Promise(r => setTimeout(r, 300));
      }
    }
  };

  // LOAD POSITIONS
  const loadPositions = async (yoClient, account, vaultList) => {
    const newPositions = {};

    for (let v of vaultList) {
      const pos = await safeCall(() =>
        yoClient.getUserPosition(v.address, account)
      );

      newPositions[v.address] = {
        assets: pos?.assets || 0n,
      };
    }

    setPositions(newPositions);
  };

  // LOAD BALANCES
  const loadBalances = async (yoClient, account, vaultList) => {
    const newBalances = {};

    for (let v of vaultList) {
      const token = v?.underlying?.address?.[8453];
      if (!token) continue;

      const result = await safeCall(() =>
        yoClient.getTokenBalance(token, account)
      );

      if (!result) continue;

      const { balance, decimals } = result;

      newBalances[v.address] =
        Number(balance) / (10 ** decimals);
    }

    setBalances(newBalances);
  };

  // LOAD VAULT STATES
  const loadVaultStates = async (yoClient, vaultList) => {
    const newStates = {};

    for (let v of vaultList) {
      const state = await safeCall(() =>
        yoClient.getVaultState(v.address)
      );

      if (state) {
        newStates[v.address] = state;
      }
    }

    setVaultStates(newStates);
  };

  // CONNECT
  const connectWallet = async () => {
    if (!window.ethereum) return alert("Install MetaMask");

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x2105" }],
      });
    } catch {}

    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    const account = accounts[0];

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

    await loadBalances(yoClient, account, vaultList);
    await loadPositions(yoClient, account, vaultList);
    await loadVaultStates(yoClient, vaultList);
  };

  const handleChange = (index, value) => {
    setAmounts({ ...amounts, [index]: value });
  };

  // DEPOSIT
  const deposit = async (vault, index) => {
    try {
      if (!yo || !walletClient) return alert("Connect wallet");

      const amount = amounts[index];
      if (!amount) return alert("Enter amount");

      const token = vault.underlying.address[8453];
      const decimals = vault.underlying.decimals;

      const txs = await yo.prepareDepositWithApproval({
        vault: vault.address,
        token,
        owner: wallet,
        recipient: wallet,
        amount: parseTokenAmount(amount, decimals),
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

      await loadBalances(yo, wallet, vaults);
      await loadPositions(yo, wallet, vaults);

    } catch (err) {
      console.error(err);
      alert(err.message || "Deposit failed");
    }
  };

  // WITHDRAW
  const withdraw = async (vault) => {
    try {
      if (!yo || !walletClient) return alert("Connect wallet");

      const shares = await yo.getShareBalance(vault.address, wallet);

      if (!shares || shares === 0n) {
        return alert("No funds");
      }

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

      await loadBalances(yo, wallet, vaults);
      await loadPositions(yo, wallet, vaults);

    } catch (err) {
      console.error(err);
      alert(err.message || "Withdraw failed");
    }
  };

  return (
    <div key={index} style={{
  background: "#111714",
  borderRadius: "16px",
  padding: "20px",
  border: "1px solid #1f2937",
  transition: "0.2s"
}}>
  <div style={{
  height: "4px",
  width: "100%",
  borderRadius: "10px",
  background: "#22c55e",
  marginBottom: "12px"
}} />

      {/* HEADER */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "20px 40px",
        borderBottom: "1px solid #1f2937"
      }}>
        <h2>YO Savings</h2>

        <button onClick={connectWallet}
          style={{
            background: "#22c55e",
            padding: "10px 18px",
            borderRadius: "8px",
            border: "none"
          }}>
          {wallet
            ? wallet.slice(0, 6) + "..." + wallet.slice(-4)
            : "Connect Wallet"}
        </button>
      </div>

      {/* HERO */}
      {!wallet && (
        <div style={{ textAlign: "center", marginTop: "100px" }}>
          <h1 style={{ fontSize: "42px" }}>
            Earn yield without the complexity
          </h1>

          <p style={{ color: "#9ca3af", marginTop: "10px" }}>
            Deposit your assets and let YO handle everything.
          </p>

          <button
            onClick={connectWallet}
            style={{
              marginTop: "20px",
              background: "#22c55e",
              padding: "12px 24px",
              borderRadius: "8px",
              border: "none"
            }}
          >
            Get Started
          </button>
        </div>
      )}

      {/* VAULTS */}
      {wallet && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "20px",
          padding: "30px",
          maxWidth: "1200px",
          margin: "0 auto"
        }}>

          {vaults.map((vault, index) => {
            const symbol = vault.underlying.symbol;
            const decimals = vault.underlying.decimals;
            const state = vaultStates[vault.address];

            return (
              <div key={index}
                style={{
                  background: "#111714",
                  borderRadius: "16px",
                  padding: "20px",
                  border: "1px solid #1f2937"
                }}>

                <h3>{vault.name}</h3>
                <p style={{ color: "#9ca3af" }}>{symbol}</p>

                <p><b>Wallet:</b> {balances[vault.address] || 0}</p>

                <p><b>TVL:</b> {
                  state
                    ? (Number(state.totalAssets) / (10 ** decimals)).toFixed(2)
                    : "Loading..."
                }</p>

                <p style={{ color: "#6b7280", fontSize: "12px" }}>
  Deposited
</p>

<p style={{ fontSize: "20px", fontWeight: "bold" }}>
  {positions[vault.address]
    ? Number(positions[vault.address].assets) /
      (10 ** vault.underlying.decimals)
    : 0}
</p>
                <input
                  placeholder={`Amount (${symbol})`}
                  value={amounts[index] || ""}
                  onChange={(e) => handleChange(index, e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    marginTop: "10px",
                    borderRadius: "6px"
                  }}
                />

                <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                  <button
  onClick={() => deposit(vault, index)}
  style={{
    flex: 1,
    padding: "10px",
    background: "#22c55e",
    borderRadius: "999px",
    fontWeight: "bold",
    border: "none",
    cursor: "pointer"
  }}
  
>
  Deposit
</button>
                </div>
                <p style={{ color: "#6b7280", fontSize: "12px", marginTop: "8px" }}>
  Yield is generated automatically by the vault
</p>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

export default App;