import { useEffect, useMemo, useState } from "react";
import styled, { keyframes } from "styled-components";
import Countdown from "react-countdown";
import { Button, CircularProgress, Snackbar } from "@material-ui/core";
import Alert from "@material-ui/lab/Alert";

import * as anchor from "@project-serum/anchor";

import { LAMPORTS_PER_SOL } from "@solana/web3.js";

import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { WalletDialogButton } from "@solana/wallet-adapter-material-ui";

import {
  CandyMachine,
  awaitTransactionSignatureConfirmation,
  getCandyMachineState,
  mintOneToken,
  shortenAddress,
} from "./candy-machine";

const ConnectButton = styled(WalletDialogButton)`
  color: var(--primary) !important;
  font-family: 'SF Pixelate' !important;
  border-radius: 0 !important;
  border: 2px solid var(--primary) !important;
  background: var(--surface) !important;
  margin-top: 2rem !important;

  
`;

const Slide = keyframes`
 0% {  background-position: 0% 0%; }
 100% { background-position: 0% 100%;  }
`

const Display = styled.div`
width: 11rem;
height: 11rem;
margin: 0 auto;
background-image: url('https://zupimages.net/up/21/43/9w16.png');
image-rendering: pixelated;
background-size: 100% 100%;
animation-name: ${Slide};
animation-duration: 4s;
animation-iteration-count: infinite;
animation-timing-function: steps(9);
margin-top: auto;
`

const Outer = styled.div`
display: flex;
justify-content: center;
align-items: center;
height: 90vh;
width: 100%;
position: relative;
font-size : 1.5rem;

`

const Info = styled.div`
margin: 1rem 0;
span{
  color: var(--primary);
  font-size : 1.25rem;
}
`

const Frame = styled.div`
position: fixed;
top: 0;
left: 0;
bottom: 0;
right: 0;
border: 1.5rem solid var(--surface);

&:before{
  content: "";
  position: absolute;
  top: 1rem;
  left: 1rem;
  right: 1rem;
  bottom: 1rem;
  border: 2px solid var(--secondary);
}

&:after{
  content: "";
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  right: 0.5rem;
  bottom: 0.5rem;
  pointer-events: none;
  border: 2px solid var(--primary);
}
`


const Banner = styled.div`
position: absolute;
top: -0.5rem;
line-height: 1;
width: 100%;
left: 0;
/* background-color: var(--bg); */
text-align: center;
font-family: 'SF Pixelate';

`

const Wrapper = styled.div`
display: block;
margin: auto;
text-align: center;
width: 90%;
max-width: 50rem;

`

const Title = styled.h1`
text-align: center;
font-family: 'SF Pixelate' !important;
font-size: 2rem;
padding: 0.5rem 0;
`;

const CounterText = styled.span``; // add your styles here

const MintContainer = styled.div``; // add your styles here

const MintButton = styled(Button)`

font-family: 'SF Pixelate' !important;
  border-radius: 0 !important;
  font-size: 1.25rem !important;
  padding: 0.5rem 2rem !important;
  margin-top: 1rem !important;
  font-size: 100px;
  border: 2px solid var(--primary) !important;
  background: var(--surface) !important;
  color: var(--primary) !important;
  
  
`; // add your styles here

export interface HomeProps {
  candyMachineId: anchor.web3.PublicKey;
  config: anchor.web3.PublicKey;
  connection: anchor.web3.Connection;
  startDate: number;
  treasury: anchor.web3.PublicKey;
  txTimeout: number;
}

const Home = (props: HomeProps) => {
  const [api_url, setUrl] = useState(process.env.REACT_APP_API_URL)
  const [balance, setBalance] = useState<number>();
  const [startDate, setStartDate] = useState(new Date(props.startDate));
  const isLive = useMemo(() => startDate <= new Date(), [startDate]);
  const [isSoldOut, setIsSoldOut] = useState(false); // true when items remaining is zero
  const [isMinting, setIsMinting] = useState(false); // true when user got to press MINT
  const [isWhitelisted, SetWhitelisted] = useState(false);

  const [itemsAvailable, setItemsAvailable] = useState(0);
  const [itemsRedeemed, setItemsRedeemed] = useState(0);
  const [itemsRemaining, setItemsRemaining] = useState(0);

  const [alertState, setAlertState] = useState<AlertState>({
    open: false,
    message: "",
    severity: undefined,
  });



  const wallet = useAnchorWallet();
  const [candyMachine, setCandyMachine] = useState<CandyMachine>();
  const refreshCandyMachineState = () => {
    (async () => {
      if (!wallet) return;

      const {
        candyMachine,
        goLiveDate,
        itemsAvailable,
        itemsRemaining,
        itemsRedeemed,
      } = await getCandyMachineState(
        wallet as anchor.Wallet,
        props.candyMachineId,
        props.connection
      );

      setItemsAvailable(itemsAvailable);
      setItemsRemaining(itemsRemaining);
      setItemsRedeemed(itemsRedeemed);

      setIsSoldOut(itemsRemaining === 0);
      setStartDate(goLiveDate);
      setCandyMachine(candyMachine);

    })();
  };

  const onMint = async () => {
    try {
      let res = await fetch(`${api_url}/whitelisted/member/${(wallet as anchor.Wallet).publicKey.toString()}`, {method: "GET"})
      const res_json = await res.json()
      const res_num = await JSON.parse(JSON.stringify(res_json)).reserve //The number  of reserves the user has left
      if(!isWhitelisted){
        throw new Error("You are not whitelisted");
      }
      if(res_num - 1 < 0){
        console.log("confirmed")
        throw new Error("Not enough reserves");
      }
      setIsMinting(true);
      if (wallet && candyMachine?.program) {
        const mintTxId = await mintOneToken(
          candyMachine,
          props.config,
          wallet.publicKey,
          props.treasury
        );

        const status = await awaitTransactionSignatureConfirmation(
          mintTxId,
          props.txTimeout,
          props.connection,
          "singleGossip",
          false
        );

        if (!status?.err) {
          setAlertState({
            open: true,
            message: "Congratulations! Mint succeeded!",
            severity: "success",
          });
          const to_send = await JSON.stringify({"reserve": res_num-1})
          await fetch(`${api_url}/whitelisted/update/${(wallet as anchor.Wallet).publicKey.toString()}/${process.env.REACT_APP_SECRET_KEY}`, {
            method: "PUT",
            headers: {
            'Content-Type': 'application/json',
            },
            body: to_send})
          console.log("Updated Reserves for user")

        } else {
          setAlertState({
            open: true,
            message: "Mint failed! Please try again!",
            severity: "error",
          });
        }
      }
    } catch (error: any) {
      // TODO: blech:
      let message = error.message || "Minting failed! Please try again!";
      if (!error.message) {
        if (error.message.indexOf("0x138")) {
        } else if (error.message.indexOf("0x137")) {
          message = `SOLD OUT!`;
        } else if (error.message.indexOf("0x135")) {
          message = `Insufficient funds to mint. Please fund your wallet.`;
        }
      } else {
        if (error.code === 311) {
          message = `SOLD OUT!`;
          setIsSoldOut(true);
        } else if (error.code === 312) {
          message = `Minting period hasn't started yet.`;
        } else if (error.message === "You are not whitelisted"){
          message = error.message;
        } else if (error.message === "Not enough reserves"){
          message = error.message
        }
      }

      setAlertState({
        open: true,
        message,
        severity: "error",
      });
    } finally {
      if (wallet) {
        const balance = await props.connection.getBalance(wallet.publicKey);
        setBalance(balance / LAMPORTS_PER_SOL);
      }
      setIsMinting(false);
      refreshCandyMachineState();
    }
  };

  useEffect(() => {
    (async () => {
      if (wallet) {
        const balance = await props.connection.getBalance(wallet.publicKey);
        setBalance(balance / LAMPORTS_PER_SOL);
        const data = await fetch(`${api_url}/whitelisted/member/${(wallet as anchor.Wallet).publicKey.toString()}`)
        if(data.status.toString() !== "404"){
          SetWhitelisted(true)
        }
        else{
          console.log("not found")
        }
      }
    })();
  }, [wallet, props.connection]);

  useEffect(refreshCandyMachineState, [
    wallet,
    props.candyMachineId,
    props.connection,
  ]);

  return (
    <Frame>
    
       
  <Outer>

  {!wallet ? (
        <Wrapper>
          <img src="https://zupimages.net/up/21/43/9w16.png" width="250"/>
          <Title>Mint Solana Koala Business</Title>
          <ConnectButton>🐨 Connect Wallet 🐨</ConnectButton>
        </Wrapper>
      ) : (
        <Wrapper>
          <Display></Display>
        <Title>Save Koalas with us !</Title>
        <Info><span>Address:</span> {shortenAddress(wallet.publicKey.toBase58() || "")}</Info>
        <Info><span>Balance:</span> {(balance || 0).toLocaleString()} SOL</Info>
        <Info><span>Minted:</span> {itemsRedeemed} / {itemsAvailable} </Info>
        <MintButton
          disabled={isSoldOut || isMinting || !isLive}
          onClick={onMint}
          variant="contained"
        >
          {isSoldOut ? (
            "SOLD OUT"
          ) : isLive ? (
            isMinting ? (
              <CircularProgress />
            ) : (
              "🐨 MINT FOR 1 SOL 🐨"
            )
          ) : (
            <Countdown
              date={startDate}
              onComplete={() => refreshCandyMachineState()}
              renderer={renderCounter}
            />
          )}
        </MintButton>
        </Wrapper>
      )}

    <Snackbar
      open={alertState.open}
      autoHideDuration={6000}
      onClose={() => setAlertState({ ...alertState, open: false })}
    >
      <Alert
        onClose={() => setAlertState({ ...alertState, open: false })}
        severity={alertState.severity}
      >
        {alertState.message}
      </Alert>
    </Snackbar>
  </Outer>
  </Frame>
);
};

interface AlertState {
  open: boolean;
  message: string;
  severity: "success" | "info" | "warning" | "error" | undefined;
}

const renderCounter = ({ days, hours, minutes, seconds, completed }: any) => {
  return (
    <CounterText>
      {hours + (days || 0) * 24} hours, {minutes} minutes, {seconds} seconds
    </CounterText>
  );
};

export default Home;
