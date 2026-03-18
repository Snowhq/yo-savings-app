import React from "react";

export default function Header({ walletAddress, onConnect }) {
  return (
    <header style={{ display: "flex", justifyContent: "space-between", padding: "20px 50px", backgroundColor: "#111", alignItems: "center" }}>
      <h1 style={{ color: "#faff00", fontSize: "28px" }}>YO Hackathon</h1>
      <button
        style={{ backgroundColor: "#39ff14", color: "#000", padding: "10px 20px", borderRadius: "8px", fontWeight: "bold" }}
        onClick={onConnect}
      >
        {walletAddress ? walletAddress.slice(0, 6) + "..." + walletAddress.slice(-4) : "Connect Wallet"}
      </button>
    </header>
  );
}
