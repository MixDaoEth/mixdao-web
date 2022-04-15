document.addEventListener('DOMContentLoaded', () => {
	//Unpkg imports
	const Web3Modal = window.Web3Modal.default
	const WalletConnectProvider = window.WalletConnectProvider.default
	const CONTRACTS = {
		4: {
			ALPHA: '0x7B50f0f22b35648ec1110974cb1991FBA25852fF', //FIXME
		},
		1: {
			ALPHA: '', //FIXME
		},
	}

	// ABI
	let alphaAbi
	fetch('./js/abi/alpha.json')
		.then((response) => {
			return response.json()
		})
		.then((data) => {alphaAbi = data})

	// Allowlist
	let maxAllowed = 0
	let allowlist, allowed, merkleTree, root, leaf
	fetch('./js/allowlist.json')
		.then((response) => {
			return response.json()
		})
		.then((data) => {
			allowlist = data
			const hashed = allowlist.map(e =>
				ethers.utils.solidityPack(['uint256', 'uint256'], [e[0].toLowerCase(), e[1]])
			)
			merkleTree = new MerkleTree(hashed, keccak256, {
				hashLeaves: true,
				sortPairs: true,
			})
			root = merkleTree.getHexRoot()
			console.log(`Presale root is: ${root}`)
		})

	let alphaContract
	let provider
	let saleInfo
	let qty = 1

	const providerOptions = {
		walletconnect: {
			package: WalletConnectProvider,
			options: {
				infuraId: '240248d1c65143c082ae6b411905d45a',
			},
		},
	}

	let web3Modal = new Web3Modal({
		cacheProvider: false,
		providerOptions,
		disableInjectedProvider: false,
	})

	// Show/hide
	const show = el => {
		if (typeof el == "string") {
			el = document.getElementById(el)
		}
		el.removeAttribute("hidden")
	}
	const hide = el => {
		if (typeof el == "string") {
			el = document.getElementById(el)
		}
		el.setAttribute("hidden", true)
	}

	// Update message
	const renderMessage = (message, type) => {
		let el = document.getElementById('message')
		el.classList = "message " + type // info, success, error
		el.textContent = message
	}

	const sectionTitle = title => {
		document.getElementById('section-title').textContent = title
	}

	const updateNetwork = async (network) => {
		if (CONTRACTS[network.chainId]) {
			hide(connectBtn)

			const alphaAddr = CONTRACTS[network.chainId].ALPHA

			if (!alphaAddr) {
				// Not available on this network
				renderMessage('Not available on this network', 'error')
				return
			}
			const signer = provider.getSigner()
			const addr = await signer.getAddress()

			// Update address display
			let addrDisplay = `${addr.substring(0, 7)}...${addr.substring(
				addr.length - 4,
				addr.length,
			)}`
			
			try {
				const name = await provider.lookupAddress(addr)
				if (name) {
					addrDisplay = name
				}
			} catch (err) {
				console.log(err)
			}
			document.getElementById('address-display').textContent = addrDisplay
			const displayTop = document.getElementById('address-display-top')
			displayTop.textContent = `Connected: ${addrDisplay}`
			show(displayTop)

			alphaContract = new ethers.Contract(alphaAddr, alphaAbi, signer)

			saleInfo = await alphaContract.saleInfo(addr)

			maxAllowed = 3 - saleInfo[4].toNumber()

			// Counter
			let maxSupply = saleInfo[1].toNumber()
			let currentlyMinted = saleInfo[2].toNumber()

			const mintBar = document.getElementById('minted');
			mintBar.style.width =
				(currentlyMinted / maxSupply) * 80 + 20 + '%'
			mintBar.textContent = `${currentlyMinted} / ${maxSupply}`
			show('minted-counter')

			renderMessage('')
			if (currentlyMinted >= maxSupply) {
				// Sold out
				show('sold-out')
				show('socials')
				hide('connect-section')
				show('disconnect-btn')
			} else if (saleInfo[0].toNumber() === 0) {
				// Not active
				renderMessage('Success! You may proceed to the allowlist mint.', 'success')
				show('proceed-btn')
			} else if (saleInfo[0].toNumber() === 1) {
				// Presale
				contractRoot = await alphaContract.merkleRoot()
				if (root != contractRoot) {
					// Cache issue
					console.log(`Contract root: ${contractRoot}`)
					renderMessage('Website outdated! Please clear your cache.', 'error')
					return
				}
				allowed = allowlist.find(pair => pair[0] == addr.toLowerCase())
				maxAllowed = allowed ? allowed[1] - saleInfo[4].toNumber() : 0
				const fwcMint = saleInfo[3].toNumber() == 0
				if (maxAllowed <= 0) {
					// FWC not allow = come back for presale
					if (fwcMint) {
						renderMessage('Sorry, you are not part of the Future Whales Club claim. Please come back during presale.', 'error')
					} else {
						renderMessage('Sorry, you are not on the allowlist. Please come back during public sale.', 'error')
					}
					return
				}
				leaf = keccak256(
					ethers.utils.solidityPack(['uint256', 'uint256'], [addr, allowed[1]])
				)
				proof = merkleTree.getHexProof(leaf)
				// Allowed
				if (fwcMint) {
					renderMessage('Success! you may proceed to the Future Whales Club claim.', 'success')
				} else {
					renderMessage('Success! you may proceed to the allowlist mint.', 'success')
				}
				show('proceed-btn')
			} else {
				// Public
				renderMessage('Success! you may proceed to the public mint.', 'success')
				show('proceed-btn')
			}
		}
	}

	let connectBtn = document.getElementById('connect-btn')
	connectBtn.addEventListener('click', async () => {
		hide(connectBtn)
		await window.Web3Modal.removeLocal('walletconnect')
		try {
			provider = await web3Modal.connect()
			provider = new ethers.providers.Web3Provider(provider)

			renderMessage('Loading...', 'info')
			provider.on('network', updateNetwork)
		} catch (err) {
			show(connectBtn)
			const msg = 'Could not get a wallet connection'
			console.log(msg, err)
			renderMessage(msg, 'error')
			return
		}
		show('disconnect-btn')
	})
	document.getElementById('disconnect-btn').addEventListener('click', async () => {
		await window.Web3Modal.removeLocal('walletconnect')
		hide('minted-counter')
		show('connect-section')
		show('connect-btn')
		hide('disconnect-btn')
		hide('sold-out')
		hide('mint-qty')
		hide('waiting')
		hide('mint-amount')
		hide('mint-total')
		hide('legal-section')
		hide('proceed-btn')
		hide('buy-btn')
		hide('legal-btn')
		hide('big-text')
		hide('socials')
		renderMessage('')
		sectionTitle('Connect')
		document.getElementById('address-display').textContent = "xxxxxx...xxxx"
	})

	document.getElementById('proceed-btn').addEventListener('click', async () => {
		hide('proceed-btn')
		sectionTitle('Get Alpha Pass')
		if (saleInfo[0].toNumber() == 0) {
			// Paused
			renderMessage('Not available yet. Come back soon.', 'info')
			const bigText = document.getElementById('big-text')
			bigText.textContent = "Paused"
			show(bigText)
		} else {
			// Sale
			updatePrice()
			hide('connect-section')
			show('disconnect-btn')
			show('mint-qty')
			show('mint-amount')
			show('mint-total')
			show('buy-btn')
			renderMessage(`Allowed maximum of ${maxAllowed}.`, 'info')
		}
	})

	const updatePrice = () => {
		document.getElementById("qty").textContent = qty
		const total = saleInfo[3].mul(qty)
		document.getElementById("price-single").textContent = ethers.utils.formatEther(saleInfo[3])
		document.getElementById("price-total").textContent = ethers.utils.formatEther(total)
	}

	// Quantity
	document.getElementById('qty-down-btn').addEventListener('click', async () => {
		if (qty > 1) {
			qty--
			updatePrice()
		}
	})
	document.getElementById('qty-up-btn').addEventListener('click', async () => {
		//FIXME Check limit
		qty++
		if (qty >= maxAllowed) {
			qty = maxAllowed
		}
		updatePrice()
	})

	document.getElementById('buy-btn').addEventListener('click', async () => {
		renderMessage('')
		if (legalOk()) {
			doMint()
		} else {
			hide('minted-counter')
			hide('mint-qty')
			hide('mint-amount')
			hide('mint-total')
			hide('buy-btn')
			show('legal-section')
			show('legal-btn')
			sectionTitle('Order confirmation')
		}
	})

	// Legal
	const legalOk = () => document.getElementById('legal1').checked && document.getElementById('legal2').checked
	const onLegalClick = () => {
		if (legalOk()) {
			document.getElementById('legal-btn').removeAttribute('disabled')
		} else {
			document.getElementById('legal-btn').setAttribute('disabled', true)
		}
	}
	document.getElementById('legal1').addEventListener('change', onLegalClick)
	document.getElementById('legal2').addEventListener('change', onLegalClick)

	// Finally!!
	const doMint = async () => {
		show('waiting')
		sectionTitle('alpha pass is being minted')
		try {
			let tx
			if (allowed) {
				//Presale
				tx = await alphaContract.mintPresale(
					qty,
					allowed[1],
					proof,
					{
						value: saleInfo[3].mul(qty)
					}
				)
			} else {
				// Public
				tx = await alphaContract.mintPublic(
					qty,
					{
						value: saleInfo[3].mul(qty)
					}
				)
			}

			renderMessage('Transaction processing.', 'info')
			await tx.wait()

			// Success
			sectionTitle('Welcome to the club')
			renderMessage('Transaction successful.', 'success')
			hide('waiting')
			show('socials')
			hide('minted-counter')
			hide('mint-qty')
			hide('mint-amount')
			hide('mint-total')
			hide('buy-btn')

		} catch (err) {
			if (err?.code === -32000 && err?.message?.indexOf("insufficient funds") > -1) {
				renderMessage('Insufficient funds.', 'error')
			} else {
				renderMessage('There was an error processing your transaction.', 'error')
			}
			console.log(err)
			sectionTitle('Get Alpha Pass')
			hide('waiting')
			show('minted-counter')
			show('mint-qty')
			show('mint-amount')
			show('mint-total')
			show('buy-btn')
		}
	}
	document.getElementById('legal-btn').addEventListener('click', async () => {
		hide('legal-section')
		hide('legal-btn')

		doMint()
	})
})
