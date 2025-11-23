if __name__ == "__main__":
    import time

    letters = input("Enter letters (first letter should be central letter): ")
    center = letters[0]
    valid = set(letters)

    start = time.time()

    results = []
    with open("wordlist_15k.txt") as f:
        for w in map(str.strip, f):
            if not w:
                continue

            if center not in w:
                continue
 
            for c in w:
                if c not in valid:
                    break
            else:
                results.append(w)

    print("\n".join(results))

    print("Execution time:", time.time() - start)
