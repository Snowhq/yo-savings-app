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
        if (i === retries - 1) throw new Error("RPC failed");
        await new Promise(r => setTimeout(r, 300));
      }
    }
  };

  // LOAD POSITIONS
  const loadPositions = async (yoClient, account, vaultList) => {
    const newPositions = {};

    for (let v of vaultList) {
      try {
        const pos = await safeCall(() =>
          yoClient.getUserPosition(v.address, account)
        );

        newPositions[v.address] = {
          assets: pos?.assets || 0n,
        };
      } catch {}
    }

    setPositions(newPositions);
  };

  // LOAD BALANCES
  const loadBalances = async (yoClient, account, vaultList) => {
    const newBalances = {};

    for (let v of vaultList) {
      const token = v?.underlying?.address?.[8453];
      if (!token) continue;

      try {
        const { balance, decimals } = await safeCall(() =>
          yoClient.getTokenBalance(token, account)
        );

        newBalances[v.address] =
          Number(balance) / (10 ** decimals);
      } catch {}
    }

    setBalances(newBalances);
  };
const loadVaultStates = async (yoClient, vaultList) => {
  const newStates = {};

  for (let v of vaultList) {
    try {
      const state = await yoClient.getVaultState(v.address);

      newStates[v.address] = state;
    } catch (err) {
      console.log("Vault load failed", v.name);
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
        await new Promise(r => setTimeout(r, 500));
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
        await new Promise(r => setTimeout(r, 500));
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
    <div style={{
      background: "#0a0a0a",
      minHeight: "100vh",
      color: "#fff",
      fontFamily: "Arial"
    }}>

      {/* HEADER */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "20px 40px",
        background: "#111",
        borderBottom: "1px solid #222"
      }}>
        <h2 style={{ color: "#faff00" }}>YO Smart Savings</h2>

        <button onClick={connectWallet}
          style={{
            background: "#39ff14",
            padding: "10px 18px",
            borderRadius: "10px",
            fontWeight: "bold",
            border: "none"
          }}>
          {wallet
            ? wallet.slice(0, 6) + "..." + wallet.slice(-4)
            : "Connect Wallet"}
        </button>
      </div>

      <h1 style={{
        textAlign: "center",
        marginTop: "30px"
      }}>
        Earn Yield on Your Assets
      </h1>

      {/* GRID */}
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
                background: "#111",
                borderRadius: "16px",
                padding: "20px",
                border: "1px solid #1f1f1f"
              }}>

              <h3 style={{ color: "#faff00" }}>{vault.name}</h3>

              <p>{symbol}</p>

              <hr style={{ border: "0.5px solid #222" }} />

              <p><b>Wallet:</b> {balances[vault.address] || 0}</p>
              <p>
  <b>TVL:</b>{" "}
  {state
    ? (Number(state.totalAssets) / (10 ** decimals)).toFixed(2)
    : "Loading..."}{" "}
  {symbol}
</p>

<p>
  <b>APY:</b>{" "}
  {state ? "Auto (Variable Yield)" : "Loading..."}
</p>

              <p><b>Deposited:</b> {
                positions[vault.address]
                  ? Number(positions[vault.address].assets) /
                    (10 ** decimals)
                  : 0
              }</p>

              <p><b>Withdrawable:</b> {
                positions[vault.address]
                  ? Number(positions[vault.address].assets) /
                    (10 ** decimals)
                  : 0
              }</p>

              <input
                placeholder={`Enter ${symbol}`}
                value={amounts[index] || ""}
                onChange={(e) => handleChange(index, e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  marginTop: "10px",
                  borderRadius: "8px",
                  background: "#000",
                  color: "#fff",
                  border: "1px solid #333"
                }}
              />

              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button onClick={() => deposit(vault, index)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    background: "#39ff14",
                    borderRadius: "8px",
                    fontWeight: "bold"
                  }}>
                  Deposit
                </button>

                <button onClick={() => withdraw(vault)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    background: "#ff4444",
                    borderRadius: "8px",
                    fontWeight: "bold"
                  }}>
                  Withdraw
                </button>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}

export default App;